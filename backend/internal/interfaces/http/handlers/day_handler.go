package handlers

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

type dayTotals struct {
	Consumed int `json:"consumed_kcal"`
	Protein  int `json:"protein_g"`
	Carbs    int `json:"carbs_g"`
	Fat      int `json:"fat_g"`
	Burned   int `json:"burned_kcal"`
	Net      int `json:"net_kcal"`
	Meals    int `json:"meals"`
	Workouts int `json:"workouts"`
}

// totals soma refeições e exercícios do dia (fuso de São Paulo). O servidor é a fonte da verdade.
func (h *APIHandler) totals(ctx context.Context, userID, day string) (dayTotals, error) {
	var t dayTotals
	var cal, p, cb, f float64
	if err := h.pool.QueryRow(ctx,
		`SELECT COALESCE(sum(total_calories),0)::float8, COALESCE(sum(total_protein_g),0)::float8,
		        COALESCE(sum(total_carbs_g),0)::float8, COALESCE(sum(total_fat_g),0)::float8, count(*)
		 FROM meals WHERE user_id=$1 AND (consumed_at AT TIME ZONE 'America/Sao_Paulo')::date=$2::date`, userID, day).
		Scan(&cal, &p, &cb, &f, &t.Meals); err != nil {
		return t, err
	}
	if err := h.pool.QueryRow(ctx,
		`SELECT COALESCE(sum(calories_burned),0), count(*) FROM workout_logs
		 WHERE user_id=$1 AND (performed_at AT TIME ZONE 'America/Sao_Paulo')::date=$2::date`, userID, day).
		Scan(&t.Burned, &t.Workouts); err != nil {
		return t, err
	}
	t.Consumed, t.Protein, t.Carbs, t.Fat = int(math.Round(cal)), int(math.Round(p)), int(math.Round(cb)), int(math.Round(f))
	t.Net = t.Consumed - t.Burned
	return t, nil
}

type closureOut struct {
	Date         string    `json:"date"`
	Consumed     int       `json:"consumed_kcal"`
	Burned       int       `json:"burned_kcal"`
	Net          int       `json:"net_kcal"`
	Goal         int       `json:"goal_kcal"`
	Diff         int       `json:"diff_kcal"`
	Protein      int       `json:"protein_g"`
	Carbs        int       `json:"carbs_g"`
	Fat          int       `json:"fat_g"`
	ProteinGoal  int       `json:"protein_goal_g"`
	CarbGoal     int       `json:"carb_goal_g"`
	FatGoal      int       `json:"fat_goal_g"`
	WaterMl      int       `json:"water_ml"`
	WaterGoalMl  int       `json:"water_goal_ml"`
	Verdict      string    `json:"verdict"`
	ClosedAt     time.Time `json:"closed_at"`
	MealsCount   int       `json:"meals"`
	WorkoutCount int       `json:"workouts"`
}

func (h *APIHandler) loadClosure(ctx context.Context, userID, day string) (*closureOut, error) {
	var c closureOut
	err := h.pool.QueryRow(ctx,
		`SELECT day::text, consumed_kcal, burned_kcal, net_kcal, goal_kcal, protein_g, carbs_g, fat_g,
		        protein_goal_g, carb_goal_g, fat_goal_g, water_ml, water_goal_ml, verdict, closed_at
		 FROM day_closures WHERE user_id=$1 AND day=$2::date`, userID, day).
		Scan(&c.Date, &c.Consumed, &c.Burned, &c.Net, &c.Goal, &c.Protein, &c.Carbs, &c.Fat,
			&c.ProteinGoal, &c.CarbGoal, &c.FatGoal, &c.WaterMl, &c.WaterGoalMl, &c.Verdict, &c.ClosedAt)
	if err != nil {
		return nil, err
	}
	c.Diff = c.Net - c.Goal
	return &c, nil
}

// DaySummary devolve os totais ao vivo do dia e, se existir, o fechamento já feito.
func (h *APIHandler) DaySummary(c *gin.Context) {
	u := middlewares.User(c)
	day, ok := pickDay(c.Query("date"))
	if !ok {
		fail(c, http.StatusBadRequest, "Data inválida.")
		return
	}
	t, err := h.totals(c.Request.Context(), u.ID, day)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao calcular o dia.")
		return
	}
	cl, _ := h.loadClosure(c.Request.Context(), u.ID, day)
	c.JSON(http.StatusOK, gin.H{"date": day, "live": t, "closure": cl})
}

type closeReq struct {
	Date        string `json:"date"`
	CalorieGoal int    `json:"calorie_goal"`
	ProteinGoal int    `json:"protein_goal_g"`
	CarbGoal    int    `json:"carb_goal_g"`
	FatGoal     int    `json:"fat_goal_g"`
	WaterMl     int    `json:"water_ml"`
	WaterGoalMl int    `json:"water_goal_ml"`
}

func inRange(v, lo, hi int) bool { return v >= lo && v <= hi }

// CloseDay "fecha a conta" do dia: congela ingeridas, queimadas, saldo e veredito contra a meta.
// Pode ser refeito (atualiza) enquanto o dia for hoje ou ontem.
func (h *APIHandler) CloseDay(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var r closeReq
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	day, ok := pickDay(r.Date)
	if !ok {
		fail(c, http.StatusBadRequest, "Só é possível fechar hoje ou ontem.")
		return
	}
	if !inRange(r.CalorieGoal, 800, 6000) || !inRange(r.ProteinGoal, 0, 1000) || !inRange(r.CarbGoal, 0, 1500) ||
		!inRange(r.FatGoal, 0, 600) || !inRange(r.WaterMl, 0, 15000) || !inRange(r.WaterGoalMl, 0, 15000) {
		fail(c, http.StatusBadRequest, "Confira as metas informadas.")
		return
	}
	ctx := c.Request.Context()
	t, err := h.totals(ctx, u.ID, day)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao calcular o dia.")
		return
	}
	verdict := domain.DayVerdict(t.Net, r.CalorieGoal)
	if _, err := h.pool.Exec(ctx,
		`INSERT INTO day_closures(user_id, day, consumed_kcal, burned_kcal, net_kcal, goal_kcal, protein_g, carbs_g, fat_g,
		   protein_goal_g, carb_goal_g, fat_goal_g, water_ml, water_goal_ml, verdict)
		 VALUES($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		 ON CONFLICT (user_id, day) DO UPDATE SET consumed_kcal=EXCLUDED.consumed_kcal, burned_kcal=EXCLUDED.burned_kcal,
		   net_kcal=EXCLUDED.net_kcal, goal_kcal=EXCLUDED.goal_kcal, protein_g=EXCLUDED.protein_g, carbs_g=EXCLUDED.carbs_g,
		   fat_g=EXCLUDED.fat_g, protein_goal_g=EXCLUDED.protein_goal_g, carb_goal_g=EXCLUDED.carb_goal_g,
		   fat_goal_g=EXCLUDED.fat_goal_g, water_ml=EXCLUDED.water_ml, water_goal_ml=EXCLUDED.water_goal_ml,
		   verdict=EXCLUDED.verdict, closed_at=now()`,
		u.ID, day, t.Consumed, t.Burned, t.Net, r.CalorieGoal, t.Protein, t.Carbs, t.Fat,
		r.ProteinGoal, r.CarbGoal, r.FatGoal, r.WaterMl, r.WaterGoalMl, verdict); err != nil {
		fail(c, http.StatusInternalServerError, "Não foi possível fechar o dia.")
		return
	}
	cl, err := h.loadClosure(ctx, u.ID, day)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Não foi possível fechar o dia.")
		return
	}
	cl.MealsCount, cl.WorkoutCount = t.Meals, t.Workouts
	c.JSON(http.StatusOK, gin.H{"status": "ok", "closure": cl})
}

type histDay struct {
	Date     string `json:"date"`
	Consumed int    `json:"consumed_kcal"`
	Burned   int    `json:"burned_kcal"`
	Net      int    `json:"net_kcal"`
	Protein  int    `json:"protein_g"`
	Meals    int    `json:"meals"`
	Closed   bool   `json:"closed"`
	Goal     int    `json:"goal_kcal,omitempty"`
	Verdict  string `json:"verdict,omitempty"`
	WaterMl  int    `json:"water_ml,omitempty"`
}

// History devolve os últimos 7 ou 30 dias (consumo, gasto, saldo e fechamentos) e a curva de peso.
func (h *APIHandler) History(c *gin.Context) {
	u := middlewares.User(c)
	n, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	if n != 7 && n != 30 {
		n = 7
	}
	ctx := c.Request.Context()
	rows, err := h.pool.Query(ctx,
		`WITH d AS (SELECT ($2::date - g)::date AS day FROM generate_series(0, $3-1) g),
		 m AS (SELECT (consumed_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, sum(total_calories) AS cal, sum(total_protein_g) AS p, count(*) AS n
		       FROM meals WHERE user_id=$1 AND consumed_at >= ($2::date - $3::int) GROUP BY 1),
		 w AS (SELECT (performed_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, sum(calories_burned) AS b
		       FROM workout_logs WHERE user_id=$1 AND performed_at >= ($2::date - $3::int) GROUP BY 1)
		 SELECT d.day::text, COALESCE(m.cal,0)::float8, COALESCE(w.b,0)::int, COALESCE(m.p,0)::float8, COALESCE(m.n,0)::int,
		        (dc.user_id IS NOT NULL), COALESCE(dc.goal_kcal,0), COALESCE(dc.verdict,''), COALESCE(dc.water_ml,0)
		 FROM d LEFT JOIN m ON m.day=d.day LEFT JOIN w ON w.day=d.day
		 LEFT JOIN day_closures dc ON dc.user_id=$1 AND dc.day=d.day
		 ORDER BY d.day`, u.ID, todaySP(), n)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao carregar o histórico.")
		return
	}
	defer rows.Close()
	days := []histDay{}
	for rows.Next() {
		var d histDay
		var cal, p float64
		if rows.Scan(&d.Date, &cal, &d.Burned, &p, &d.Meals, &d.Closed, &d.Goal, &d.Verdict, &d.WaterMl) != nil {
			continue
		}
		d.Consumed, d.Protein = int(math.Round(cal)), int(math.Round(p))
		d.Net = d.Consumed - d.Burned
		days = append(days, d)
	}
	rows.Close()
	c.JSON(http.StatusOK, gin.H{"days": days, "weights": h.weights(ctx, u.ID, 90)})
}

type weightPoint struct {
	Date string  `json:"date"`
	Kg   float64 `json:"kg"`
}

func (h *APIHandler) weights(ctx context.Context, userID string, days int) []weightPoint {
	out := []weightPoint{}
	rows, err := h.pool.Query(ctx,
		`SELECT logged_on::text, weight_kg::float8 FROM weight_logs WHERE user_id=$1 AND logged_on >= ($2::date - $3::int) ORDER BY logged_on`,
		userID, todaySP(), days)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var w weightPoint
		if rows.Scan(&w.Date, &w.Kg) == nil {
			out = append(out, w)
		}
	}
	return out
}

// LogWeight registra (ou atualiza) o peso do dia.
func (h *APIHandler) LogWeight(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		WeightKg float64 `json:"weight_kg"`
		Date     string  `json:"date"`
	}
	if err := c.ShouldBindJSON(&r); err != nil || !(r.WeightKg >= 30 && r.WeightKg <= 300) {
		fail(c, http.StatusBadRequest, "Informe um peso entre 30 e 300 kg.")
		return
	}
	day, ok := pickDay(r.Date)
	if !ok {
		fail(c, http.StatusBadRequest, "Data inválida.")
		return
	}
	kg := math.Round(r.WeightKg*10) / 10
	if _, err := h.pool.Exec(c.Request.Context(),
		`INSERT INTO weight_logs(user_id, logged_on, weight_kg) VALUES($1,$2::date,$3)
		 ON CONFLICT (user_id, logged_on) DO UPDATE SET weight_kg=EXCLUDED.weight_kg, created_at=now()`, u.ID, day, kg); err != nil {
		fail(c, http.StatusInternalServerError, "Não foi possível salvar o peso.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "weights": h.weights(c.Request.Context(), u.ID, 90)})
}
