package handlers

import (
	"context"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/application"
	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

const maxImageBytes = 8 << 20

var allowedMeal = map[string]bool{"cafe": true, "almoco": true, "lanche": true, "jantar": true, "outro": true}

func mealTypeByHour() string {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return "outro"
	}
	switch h := time.Now().In(loc).Hour(); {
	case h >= 5 && h < 10:
		return "cafe"
	case h >= 10 && h < 15:
		return "almoco"
	case h >= 15 && h < 18:
		return "lanche"
	case h >= 18 && h < 23:
		return "jantar"
	}
	return "outro"
}

func okImage(b []byte) (string, bool) {
	t := http.DetectContentType(b)
	switch t {
	case "image/jpeg", "image/png", "image/webp":
		return t, true
	}
	return "", false
}

// AnalyzeMeal: foto -> cota -> IA -> grava a refeição. A imagem NÃO é armazenada.
func (h *APIHandler) AnalyzeMeal(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImageBytes+(256<<10))
	file, _, err := c.Request.FormFile("image")
	if err != nil {
		fail(c, http.StatusBadRequest, "Envie a foto do prato no campo 'image' (até 8 MB).")
		return
	}
	defer file.Close()
	imageBytes, err := io.ReadAll(io.LimitReader(file, maxImageBytes+1))
	if err != nil || len(imageBytes) == 0 || len(imageBytes) > maxImageBytes {
		fail(c, http.StatusBadRequest, "Foto inválida ou maior que 8 MB.")
		return
	}
	mime, ok := okImage(imageBytes)
	if !ok {
		fail(c, http.StatusBadRequest, "Formato não suportado. Use JPG, PNG ou WebP.")
		return
	}
	mealType := c.PostForm("meal_type")
	if !allowedMeal[mealType] {
		mealType = mealTypeByHour()
	}

	ctx := c.Request.Context()
	id, usage, err := h.quota.Reserve(ctx, u.ID, u.Email)
	switch {
	case errors.Is(err, application.ErrQuota):
		code := "quota_trial"
		msg := "Suas 3 fotos grátis acabaram. Assine um plano para continuar."
		if usage.Plan != "teste" {
			code = "quota_plan"
			msg = "Você atingiu o limite de fotos do seu plano neste período."
		}
		c.JSON(http.StatusPaymentRequired, gin.H{"error": msg, "code": code, "usage": usage})
		return
	case errors.Is(err, application.ErrGlobalCap):
		fail(c, http.StatusServiceUnavailable, "Estamos com muita demanda agora. Tente novamente em alguns minutos.")
		return
	case err != nil:
		fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
		return
	}

	actx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	type out struct {
		r   *domain.GeminiResponseSchema
		err error
	}
	ch := make(chan out, 1)
	go func() {
		r, e := h.mealService.ProcessMealPhoto(imageBytes, mime, "pt-BR")
		ch <- out{r, e}
	}()
	var res out
	select {
	case res = <-ch:
	case <-actx.Done():
		res.err = gemini.ErrUpstream
	}
	if res.err != nil || res.r == nil {
		h.quota.Release(context.Background(), id)
		msg := "Não foi possível analisar agora. Tente novamente — esta foto não foi descontada."
		if errors.Is(res.err, gemini.ErrNotConfigured) {
			msg = "A análise por foto ainda não está disponível. Tente novamente em breve — esta foto não foi descontada."
		}
		fail(c, http.StatusBadGateway, msg)
		return
	}

	m := res.r.MealSummary
	mealID, err := h.saveMeal(ctx, u.ID, mealType, res.r)
	if err != nil {
		h.quota.Release(context.Background(), id)
		fail(c, http.StatusInternalServerError, "Erro ao salvar a refeição. Tente novamente — esta foto não foi descontada.")
		return
	}
	h.quota.Confirm(ctx, id)
	usage2, _ := h.quota.Summary(ctx, u.ID, u.Email)
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"meal_id":   mealID,
		"meal_type": mealType,
		"data":      gin.H{"meal_summary": m, "items": res.r.Items},
		"usage":     usage2,
	})
}

func (h *APIHandler) saveMeal(ctx context.Context, userID, mealType string, r *domain.GeminiResponseSchema) (string, error) {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	m := r.MealSummary
	var id string
	if err := tx.QueryRow(ctx,
		`INSERT INTO meals(user_id, meal_type, name, total_calories, total_protein_g, total_carbs_g, total_fat_g, confidence_level, notes)
		 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text`,
		userID, mealType, m.Name, m.TotalCalories, m.TotalProteinG, m.TotalCarbsG, m.TotalFatG, m.ConfidenceLevel, m.Notes).Scan(&id); err != nil {
		return "", err
	}
	for _, it := range r.Items {
		if _, err := tx.Exec(ctx,
			`INSERT INTO meal_items(meal_id, food_name, estimated_weight_g, calories, protein_g, carbs_g, fat_g) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			id, it.Name, it.EstimatedWeightG, it.Calories, it.ProteinG, it.CarbsG, it.FatG); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

// ListMeals devolve as refeições do dia (?date=YYYY-MM-DD, fuso de São Paulo).
func (h *APIHandler) ListMeals(c *gin.Context) {
	u := middlewares.User(c)
	date := c.Query("date")
	if _, err := time.Parse("2006-01-02", date); err != nil {
		loc, _ := time.LoadLocation("America/Sao_Paulo")
		date = time.Now().In(loc).Format("2006-01-02")
	}
	rows, err := h.pool.Query(c.Request.Context(),
		`SELECT m.id::text, m.meal_type, COALESCE(m.name,''), m.total_calories::float8, m.total_protein_g::float8, m.total_carbs_g::float8, m.total_fat_g::float8,
		        COALESCE(m.confidence_level,''), COALESCE(m.notes,''), m.consumed_at
		 FROM meals m WHERE m.user_id=$1 AND (m.consumed_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date
		 ORDER BY m.consumed_at DESC LIMIT 100`, u.ID, date)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao carregar o diário.")
		return
	}
	defer rows.Close()
	type meal struct {
		ID         string    `json:"id"`
		MealType   string    `json:"meal_type"`
		Name       string    `json:"name"`
		Calories   float64   `json:"total_calories"`
		Protein    float64   `json:"total_protein_g"`
		Carbs      float64   `json:"total_carbs_g"`
		Fat        float64   `json:"total_fat_g"`
		Confidence string    `json:"confidence_level"`
		Notes      string    `json:"notes"`
		ConsumedAt time.Time `json:"consumed_at"`
	}
	list := []meal{}
	for rows.Next() {
		var m meal
		if err := rows.Scan(&m.ID, &m.MealType, &m.Name, &m.Calories, &m.Protein, &m.Carbs, &m.Fat, &m.Confidence, &m.Notes, &m.ConsumedAt); err != nil {
			fail(c, http.StatusInternalServerError, "Erro ao carregar o diário.")
			return
		}
		list = append(list, m)
	}
	c.JSON(http.StatusOK, gin.H{"date": date, "meals": list})
}

func (h *APIHandler) DeleteMeal(c *gin.Context) {
	u := middlewares.User(c)
	tag, err := h.pool.Exec(c.Request.Context(), `DELETE FROM meals WHERE id::text=$1 AND user_id=$2`, c.Param("id"), u.ID)
	if err != nil || tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Refeição não encontrada.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
