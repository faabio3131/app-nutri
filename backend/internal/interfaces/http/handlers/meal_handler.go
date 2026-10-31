package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
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

const (
	maxTextChars     = 300
	textLimitTrial   = 5
	textLimitPaid    = 30
	textLimitMessage = "Você atingiu o limite de registros por texto de hoje. Tente amanhã ou use a foto."
)

// AnalyzeText: descrição escrita -> IA -> grava a refeição. Não consome as fotos do plano; tem limite diário próprio.
func (h *APIHandler) AnalyzeText(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var r struct {
		Text     string `json:"text"`
		MealType string `json:"meal_type"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Descreva o que você comeu.")
		return
	}
	text := strings.TrimSpace(r.Text)
	if len([]rune(text)) < 3 {
		fail(c, http.StatusBadRequest, "Descreva o que você comeu (ex.: 2 ovos mexidos e 1 pão francês).")
		return
	}
	if len([]rune(text)) > maxTextChars {
		fail(c, http.StatusBadRequest, "Descrição muito longa (máx. 300 caracteres).")
		return
	}
	mealType := r.MealType
	if !allowedMeal[mealType] {
		mealType = mealTypeByHour()
	}
	ctx := c.Request.Context()
	usage, err := h.quota.Summary(ctx, u.ID, u.Email)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
		return
	}
	limit := textLimitPaid
	if usage.Plan == "teste" {
		limit = textLimitTrial
	}
	id, ok, err := h.reserveText(ctx, u.ID, limit)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
		return
	}
	if !ok {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": textLimitMessage, "code": "text_limit"})
		return
	}
	release := func() {
		h.pool.Exec(context.Background(), `DELETE FROM photo_analyses WHERE id=$1 AND status='pending'`, id)
	}

	actx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	type out struct {
		r   *domain.GeminiResponseSchema
		err error
	}
	ch := make(chan out, 1)
	go func() {
		res, e := h.mealService.ProcessMealText(text, "pt-BR")
		ch <- out{res, e}
	}()
	var res out
	select {
	case res = <-ch:
	case <-actx.Done():
		res.err = gemini.ErrUpstream
	}
	if res.err != nil || res.r == nil {
		release()
		msg := "Não foi possível analisar agora. Tente novamente."
		if errors.Is(res.err, gemini.ErrNotConfigured) {
			msg = "A análise ainda não está disponível. Tente novamente em breve."
		}
		fail(c, http.StatusBadGateway, msg)
		return
	}
	if len(res.r.Items) == 0 || res.r.MealSummary.TotalCalories <= 0 {
		release()
		fail(c, http.StatusUnprocessableEntity, "Não reconheci alimentos nessa descrição. Tente algo como: arroz, feijão e 1 bife.")
		return
	}
	mealID, err := h.saveMeal(ctx, u.ID, mealType, res.r)
	if err != nil {
		release()
		fail(c, http.StatusInternalServerError, "Erro ao salvar a refeição. Tente novamente.")
		return
	}
	h.pool.Exec(ctx, `UPDATE photo_analyses SET status='ok' WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"meal_id":   mealID,
		"meal_type": mealType,
		"data":      gin.H{"meal_summary": res.r.MealSummary, "items": res.r.Items},
	})
}

// reserveText reserva 1 uso diário de texto de forma atômica (lock por usuário).
func (h *APIHandler) reserveText(ctx context.Context, userID string, limit int) (string, bool, error) {
	return h.reserveSource(ctx, userID, "text", limit)
}

// reserveSource reserva 1 uso diário de uma fonte de IA sem foto ("text" ou "refine"), de forma atômica.
func (h *APIHandler) reserveSource(ctx context.Context, userID, source string, limit int) (string, bool, error) {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, source+":"+userID); err != nil {
		return "", false, err
	}
	tx.Exec(ctx, `DELETE FROM photo_analyses WHERE user_id=$1 AND source=$2 AND status='pending' AND created_at < now() - interval '3 minutes'`, userID, source)
	var n int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND source=$2 AND status IN ('ok','pending')
		AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`, userID, source).Scan(&n); err != nil {
		return "", false, err
	}
	if n >= limit {
		return "", false, nil
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO photo_analyses(user_id, source) VALUES($1,$2) RETURNING id::text`, userID, source).Scan(&id); err != nil {
		return "", false, err
	}
	return id, true, tx.Commit(ctx)
}

// UpdateMeal ajusta a porção (fator ¼x–4x) e/ou o nome de uma refeição já registrada. Não gasta foto nem IA.
func (h *APIHandler) UpdateMeal(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		Factor *float64 `json:"factor"`
		Name   *string  `json:"name"`
	}
	if err := c.ShouldBindJSON(&r); err != nil || (r.Factor == nil && r.Name == nil) {
		fail(c, http.StatusBadRequest, "Nada para alterar.")
		return
	}
	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao atualizar.")
		return
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT true FROM meals WHERE id::text=$1 AND user_id=$2 FOR UPDATE`, c.Param("id"), u.ID).Scan(&exists); err != nil {
		fail(c, http.StatusNotFound, "Refeição não encontrada.")
		return
	}
	if r.Name != nil {
		name := strings.TrimSpace(*r.Name)
		if name == "" || len([]rune(name)) > 120 {
			fail(c, http.StatusBadRequest, "Nome inválido (1 a 120 caracteres).")
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE meals SET name=$1 WHERE id::text=$2 AND user_id=$3`, name, c.Param("id"), u.ID); err != nil {
			fail(c, http.StatusInternalServerError, "Erro ao atualizar.")
			return
		}
	}
	if r.Factor != nil {
		if !domain.ScaleFactorValid(*r.Factor) {
			fail(c, http.StatusBadRequest, "Porção entre ¼x e 4x.")
			return
		}
		f := *r.Factor
		if _, err := tx.Exec(ctx, `UPDATE meals SET total_calories=LEAST(total_calories*$1,9999.99), total_protein_g=LEAST(total_protein_g*$1,9999.99),
			total_carbs_g=LEAST(total_carbs_g*$1,9999.99), total_fat_g=LEAST(total_fat_g*$1,9999.99) WHERE id::text=$2 AND user_id=$3`, f, c.Param("id"), u.ID); err != nil {
			fail(c, http.StatusInternalServerError, "Erro ao atualizar.")
			return
		}
		if _, err := tx.Exec(ctx, `UPDATE meal_items SET estimated_weight_g=LEAST(estimated_weight_g*$1,9999.99), calories=LEAST(calories*$1,9999.99),
			protein_g=LEAST(protein_g*$1,9999.99), carbs_g=LEAST(carbs_g*$1,9999.99), fat_g=LEAST(fat_g*$1,9999.99) WHERE meal_id::text=$2`, f, c.Param("id")); err != nil {
			fail(c, http.StatusInternalServerError, "Erro ao atualizar.")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao atualizar.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

const (
	refineLimitTrial = 10
	refineLimitPaid  = 40
)

// RefineMeal recalcula uma refeição já registrada a partir do que o usuário confirmou (nome e quantidade em ml ou g).
// Não gasta foto; tem limite diário próprio. O nome é tratado como dado, nunca como instrução.
func (h *APIHandler) RefineMeal(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		Name   string  `json:"name"`
		Amount float64 `json:"amount"`
		Unit   string  `json:"unit"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Informe o que é e a quantidade.")
		return
	}
	name := strings.TrimSpace(strings.NewReplacer("<", "", ">", "", "\n", " ", "\r", " ").Replace(r.Name))
	if n := len([]rune(name)); n < 2 || n > 80 {
		fail(c, http.StatusBadRequest, "Nome inválido (2 a 80 caracteres).")
		return
	}
	if r.Unit != "ml" && r.Unit != "g" {
		fail(c, http.StatusBadRequest, "Use ml ou g.")
		return
	}
	if !(r.Amount >= 1 && r.Amount <= 5000) {
		fail(c, http.StatusBadRequest, "Quantidade entre 1 e 5000.")
		return
	}
	ctx := c.Request.Context()
	var mealID string
	if err := h.pool.QueryRow(ctx, `SELECT id::text FROM meals WHERE id::text=$1 AND user_id=$2`, c.Param("id"), u.ID).Scan(&mealID); err != nil {
		fail(c, http.StatusNotFound, "Refeição não encontrada.")
		return
	}
	usage, err := h.quota.Summary(ctx, u.ID, u.Email)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
		return
	}
	limit := refineLimitPaid
	if usage.Plan == "teste" {
		limit = refineLimitTrial
	}
	id, ok, err := h.reserveSource(ctx, u.ID, "refine", limit)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
		return
	}
	if !ok {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Você atingiu o limite de correções de hoje. Use \"Editar\" para ajustar a porção.", "code": "refine_limit"})
		return
	}
	release := func() {
		h.pool.Exec(context.Background(), `DELETE FROM photo_analyses WHERE id=$1 AND status='pending'`, id)
	}
	desc := fmt.Sprintf("%g %s de %s", r.Amount, r.Unit, name)
	actx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	type out struct {
		r   *domain.GeminiResponseSchema
		err error
	}
	ch := make(chan out, 1)
	go func() {
		res, e := h.mealService.ProcessMealText(desc, "pt-BR")
		ch <- out{res, e}
	}()
	var res out
	select {
	case res = <-ch:
	case <-actx.Done():
		res.err = gemini.ErrUpstream
	}
	if res.err != nil || res.r == nil {
		release()
		fail(c, http.StatusBadGateway, "Não foi possível recalcular agora. Tente novamente.")
		return
	}
	if len(res.r.Items) == 0 || res.r.MealSummary.TotalCalories <= 0 {
		release()
		fail(c, http.StatusUnprocessableEntity, "Não consegui calcular esse alimento. Confira o nome e tente de novo.")
		return
	}
	m := res.r.MealSummary
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		release()
		fail(c, http.StatusInternalServerError, "Erro ao salvar.")
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE meals SET name=$1, total_calories=$2, total_protein_g=$3, total_carbs_g=$4, total_fat_g=$5, confidence_level='ALTO', notes=$6
		WHERE id::text=$7 AND user_id=$8`, name, m.TotalCalories, m.TotalProteinG, m.TotalCarbsG, m.TotalFatG, m.Notes, mealID, u.ID); err != nil {
		release()
		fail(c, http.StatusInternalServerError, "Erro ao salvar.")
		return
	}
	if _, err := tx.Exec(ctx, `DELETE FROM meal_items WHERE meal_id::text=$1`, mealID); err != nil {
		release()
		fail(c, http.StatusInternalServerError, "Erro ao salvar.")
		return
	}
	for _, it := range res.r.Items {
		if _, err := tx.Exec(ctx, `INSERT INTO meal_items(meal_id, food_name, estimated_weight_g, calories, protein_g, carbs_g, fat_g) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			mealID, it.Name, it.EstimatedWeightG, it.Calories, it.ProteinG, it.CarbsG, it.FatG); err != nil {
			release()
			fail(c, http.StatusInternalServerError, "Erro ao salvar.")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		release()
		fail(c, http.StatusInternalServerError, "Erro ao salvar.")
		return
	}
	h.pool.Exec(ctx, `UPDATE photo_analyses SET status='ok' WHERE id=$1`, id)
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"meal_id": mealID,
		"data":    gin.H{"meal_summary": gin.H{"name": name, "total_calories": m.TotalCalories, "total_protein_g": m.TotalProteinG, "total_carbs_g": m.TotalCarbsG, "total_fat_g": m.TotalFatG}, "items": res.r.Items},
	})
}
