package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

func spLoc() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.FixedZone("BRT", -3*3600)
	}
	return loc
}

// todaySP devolve a data de hoje (AAAA-MM-DD) no fuso de São Paulo.
func todaySP() string { return time.Now().In(spLoc()).Format("2006-01-02") }

// pickDay valida ?date / campo date: vazio = hoje; aceita apenas hoje ou ontem (não se "fabrica" histórico antigo).
func pickDay(s string) (string, bool) {
	today := todaySP()
	if s == "" || s == today {
		return today, true
	}
	yesterday := time.Now().In(spLoc()).AddDate(0, 0, -1).Format("2006-01-02")
	if s == yesterday {
		return yesterday, true
	}
	return "", false
}

// lastWeight devolve o peso mais recente registrado (0 se não houver).
func (h *APIHandler) lastWeight(ctx context.Context, userID string) float64 {
	var w float64
	if h.pool.QueryRow(ctx, `SELECT weight_kg::float8 FROM weight_logs WHERE user_id=$1 ORDER BY logged_on DESC LIMIT 1`, userID).Scan(&w) != nil {
		return 0
	}
	return w
}

type workoutOut struct {
	ID             string    `json:"id"`
	Activity       string    `json:"activity"`
	DurationMin    int       `json:"duration_min"`
	Intensity      string    `json:"intensity"`
	CaloriesBurned int       `json:"calories_burned"`
	PerformedAt    time.Time `json:"performed_at"`
	Ref            string    `json:"ref,omitempty"`
}

// RegisterWorkout grava um exercício (avulso ou item da rotina) e devolve as calorias líquidas gastas,
// calculadas no servidor com o peso da pessoa (MET).
func (h *APIHandler) RegisterWorkout(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var req domain.WorkoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "Dados de treino inválidos.")
		return
	}
	req.ActivityType = strings.ToLower(strings.TrimSpace(req.ActivityType))
	if !domain.ValidActivity(req.ActivityType) {
		fail(c, http.StatusBadRequest, "Atividade não reconhecida.")
		return
	}
	if req.Intensity != "leve" && req.Intensity != "moderada" && req.Intensity != "intensa" {
		req.Intensity = "moderada"
	}
	if req.DurationMin < 1 || req.DurationMin > 600 {
		fail(c, http.StatusBadRequest, "Duração deve ficar entre 1 e 600 minutos.")
		return
	}
	if len(req.Ref) > 80 {
		fail(c, http.StatusBadRequest, "Referência inválida.")
		return
	}
	day, ok := pickDay(req.Date)
	if !ok {
		fail(c, http.StatusBadRequest, "Só é possível registrar exercícios de hoje ou de ontem.")
		return
	}
	ctx := c.Request.Context()
	weight := req.WeightKg
	if weight < 30 || weight > 300 {
		weight = h.lastWeight(ctx, u.ID)
	}
	estimated := weight < 30
	burned := domain.CalculateCaloriesBurned(req.ActivityType, req.DurationMin, req.Intensity, weight)

	// Horário gravado: agora, se for hoje; 12:00 se for ontem.
	at := time.Now()
	if day != todaySP() {
		y, _ := time.ParseInLocation("2006-01-02", day, spLoc())
		at = y.Add(12 * time.Hour)
	}
	var ref any
	if req.Ref != "" {
		ref = req.Ref
	}
	var out workoutOut
	err := h.pool.QueryRow(ctx,
		`INSERT INTO workout_logs(user_id, performed_at, activity, duration_min, intensity, calories_burned, weight_kg, ref)
		 VALUES($1,$2,$3,$4,$5,$6,NULLIF($7,0),$8)
		 ON CONFLICT (user_id, ref) WHERE ref IS NOT NULL DO UPDATE SET performed_at=workout_logs.performed_at
		 RETURNING id::text, activity, duration_min, intensity, calories_burned, performed_at, COALESCE(ref,'')`,
		u.ID, at, req.ActivityType, req.DurationMin, req.Intensity, burned, weight, ref).
		Scan(&out.ID, &out.Activity, &out.DurationMin, &out.Intensity, &out.CaloriesBurned, &out.PerformedAt, &out.Ref)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Não foi possível registrar o exercício.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": out, "weight_estimated": estimated})
}

// ListWorkouts devolve os exercícios do dia (?date=, fuso de São Paulo).
func (h *APIHandler) ListWorkouts(c *gin.Context) {
	u := middlewares.User(c)
	date := c.Query("date")
	if _, err := time.Parse("2006-01-02", date); err != nil {
		date = todaySP()
	}
	rows, err := h.pool.Query(c.Request.Context(),
		`SELECT id::text, activity, duration_min, intensity, calories_burned, performed_at, COALESCE(ref,'')
		 FROM workout_logs WHERE user_id=$1 AND (performed_at AT TIME ZONE 'America/Sao_Paulo')::date=$2::date
		 ORDER BY performed_at DESC LIMIT 100`, u.ID, date)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao carregar os exercícios.")
		return
	}
	defer rows.Close()
	list := []workoutOut{}
	total := 0
	for rows.Next() {
		var w workoutOut
		if rows.Scan(&w.ID, &w.Activity, &w.DurationMin, &w.Intensity, &w.CaloriesBurned, &w.PerformedAt, &w.Ref) == nil {
			list = append(list, w)
			total += w.CaloriesBurned
		}
	}
	c.JSON(http.StatusOK, gin.H{"date": date, "workouts": list, "total_burned": total})
}

// DeleteWorkout remove um exercício pelo id.
func (h *APIHandler) DeleteWorkout(c *gin.Context) {
	u := middlewares.User(c)
	tag, err := h.pool.Exec(c.Request.Context(), `DELETE FROM workout_logs WHERE id::text=$1 AND user_id=$2`, c.Param("id"), u.ID)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Exercício não encontrado.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// DeleteWorkoutByRef remove o exercício ligado a um item da rotina (desmarcar "feito").
func (h *APIHandler) DeleteWorkoutByRef(c *gin.Context) {
	u := middlewares.User(c)
	ref := c.Query("ref")
	if ref == "" || len(ref) > 80 {
		fail(c, http.StatusBadRequest, "Referência inválida.")
		return
	}
	h.pool.Exec(c.Request.Context(), `DELETE FROM workout_logs WHERE user_id=$1 AND ref=$2`, u.ID, ref)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
