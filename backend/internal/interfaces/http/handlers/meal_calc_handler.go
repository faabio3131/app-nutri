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
	"github.com/faabio3131/app-nutri/backend/internal/catalog"
	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

// Catalog devolve as tabelas de referência (sem os números de fonte longos) para a tela montar a lista de itens e bebidas.
func (h *APIHandler) Catalog(c *gin.Context) {
	type food struct {
		ID         string  `json:"id"`
		Name       string  `json:"name"`
		Category   string  `json:"category"`
		DefaultG   float64 `json:"default_g"`
		FixedG     float64 `json:"fixed_g"`
		UnitG      float64 `json:"unit_g"`
		NeedsGrams bool    `json:"needs_grams"`
	}
	type drink struct {
		ID         string `json:"id"`
		Group      string `json:"group"`
		GroupLabel string `json:"group_label"`
		Variant    string `json:"variant"`
	}
	foods := make([]food, 0, len(catalog.Foods))
	for _, f := range catalog.Foods {
		foods = append(foods, food{f.ID, f.Name, f.Category, f.DefaultG, f.FixedG, f.UnitG, f.NeedsGrams})
	}
	drinks := make([]drink, 0, len(catalog.Drinks))
	for _, d := range catalog.Drinks {
		drinks = append(drinks, drink{d.ID, d.Group, d.GroupLabel, d.Variant})
	}
	c.Header("Cache-Control", "private, max-age=3600")
	c.JSON(http.StatusOK, gin.H{"foods": foods, "drinks": drinks})
}

// ScanMeal: foto -> cota de foto -> IA LÊ (itens/bebida, sem calorias). Nada é gravado: o usuário confirma e o app calcula.
func (h *APIHandler) ScanMeal(c *gin.Context) {
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
		r   *domain.ScanResult
		err error
	}
	ch := make(chan out, 1)
	go func() {
		r, e := h.mealService.ScanPhoto(imageBytes, mime)
		ch <- out{r, e}
	}()
	var res out
	select {
	case res = <-ch:
	case <-actx.Done():
		res.err = gemini.ErrUpstream
	}
	if res.err != nil || res.r == nil || (len(res.r.Items) == 0 && res.r.Drink.DrinkID == "" && res.r.Kind == "prato" && res.r.Name == "") {
		h.quota.Release(context.Background(), id)
		msg := "Não foi possível ler a foto agora. Tente novamente — esta foto não foi descontada."
		if errors.Is(res.err, gemini.ErrNotConfigured) {
			msg = "A leitura por foto ainda não está disponível. Tente novamente em breve — esta foto não foi descontada."
		}
		fail(c, http.StatusBadGateway, msg)
		return
	}
	h.quota.Confirm(ctx, id)
	usage2, _ := h.quota.Summary(ctx, u.ID, u.Email)
	c.JSON(http.StatusOK, gin.H{"status": "success", "meal_type": mealType, "scan": res.r, "hints": scanHints(res.r), "usage": usage2})
}

type hint struct {
	Text  string `json:"text"`
	AddID string `json:"add_id"`
}

// scanHints sugere perguntas sobre o que a foto não consegue mostrar (alimento coberto por outro).
func scanHints(r *domain.ScanResult) []hint {
	if r.Kind != "prato" {
		return nil
	}
	has := map[string]bool{}
	for _, it := range r.Items {
		has[it.FoodID] = true
	}
	var hs []hint
	if has["arroz_branco"] || has["arroz_integral"] {
		if !has["feijao_carioca"] && !has["feijao_preto"] && !has["lentilha"] && !has["feijoada"] {
			hs = append(hs, hint{"Tem feijão por baixo do arroz?", "feijao_carioca"})
		}
	}
	return hs
}

type calcDrink struct {
	DrinkID      string  `json:"drink_id"`
	ML           float64 `json:"ml"`
	LabelKcal100 float64 `json:"label_kcal_100ml"`
}

type calcReq struct {
	Mode       string           `json:"mode"`
	Save       bool             `json:"save"`
	MealType   string           `json:"meal_type"`
	Name       string           `json:"name"`
	Items      []catalog.ItemIn `json:"items"`
	TotalG     float64          `json:"total_g"`
	ScanTotalG float64          `json:"scan_total_g"`
	Complement string           `json:"complement"`
	Drink      calcDrink        `json:"drink"`
}

func cleanText(s string, n int) string {
	s = strings.NewReplacer("<", "", ">", "", "\n", " ", "\r", " ", "\t", " ").Replace(s)
	r := []rune(strings.TrimSpace(s))
	if len(r) > n {
		r = r[:n]
	}
	return string(r)
}

// reserveAICalc reserva 1 uso de IA no cálculo (itens fora da tabela). O limite é o MESMO das fotos do plano:
// teste = 3 no total; plano = limite mensal e, quando existe, o diário. Cálculo só pela tabela não gasta nada.
func (h *APIHandler) reserveAICalc(ctx context.Context, userID, email string) (string, bool, error) {
	usage, err := h.quota.Summary(ctx, userID, email)
	if err != nil {
		return "", false, err
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "calc_ai:"+userID); err != nil {
		return "", false, err
	}
	tx.Exec(ctx, `DELETE FROM photo_analyses WHERE user_id=$1 AND source='calc_ai' AND status='pending' AND created_at < now() - interval '3 minutes'`, userID)
	window := `true`
	if usage.Plan != "teste" {
		window = `date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')`
	}
	var total, today int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND source='calc_ai' AND status IN ('ok','pending') AND `+window, userID).Scan(&total); err != nil {
		return "", false, err
	}
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND source='calc_ai' AND status IN ('ok','pending')
		AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`, userID).Scan(&today); err != nil {
		return "", false, err
	}
	if total >= usage.Limit || (usage.DailyLimit > 0 && today >= usage.DailyLimit) {
		return "", false, nil
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO photo_analyses(user_id, source) VALUES($1,'calc_ai') RETURNING id::text`, userID).Scan(&id); err != nil {
		return "", false, err
	}
	return id, true, tx.Commit(ctx)
}

// CalcMeal calcula pela tabela (prévia grátis) e, com save=true, grava a refeição.
// Só itens fora da tabela usam IA, dentro do mesmo limite das fotos.
func (h *APIHandler) CalcMeal(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var r calcReq
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	mealType := r.MealType
	if !allowedMeal[mealType] {
		mealType = mealTypeByHour()
	}
	name := cleanText(r.Name, 80)
	var res *catalog.Result
	var notes []string
	var err error
	switch r.Mode {
	case "bebida":
		res, err = catalog.DrinkCalc(r.Drink.DrinkID, r.Drink.ML, r.Drink.LabelKcal100)
		if err != nil {
			fail(c, http.StatusBadRequest, err.Error())
			return
		}
		if name == "" && len(res.Items) == 1 {
			name = fmt.Sprintf("%s (%g ml)", res.Items[0].Name, r.Drink.ML)
		}
	case "prato":
		if len(r.Items) > 30 {
			fail(c, http.StatusBadRequest, "Itens demais (máx. 30).")
			return
		}
		items := make([]catalog.ItemIn, 0, len(r.Items)+4)
		have := map[string]bool{}
		for _, it := range r.Items {
			it.Name = cleanText(it.Name, 60)
			items = append(items, it)
			if it.FoodID != "" {
				have[it.FoodID] = true
			}
		}
		comp := cleanText(r.Complement, 200)
		if comp != "" {
			found, left := catalog.ParseComplement(comp)
			for _, f := range found {
				if !have[f.FoodID] {
					// Item citado no complemento sem quantidade: entra com a porção padrão (não divide o volume do prato).
					if fd, ok := catalog.FoodByID(f.FoodID); ok && f.Grams <= 0 && f.Qty <= 0 && fd.DefaultG > 0 {
						f.Grams = fd.DefaultG
					}
					items = append(items, f)
					have[f.FoodID] = true
				}
			}
			if left != "" {
				notes = append(notes, "Complemento: "+left)
			}
		}
		res, err = catalog.Plate(items, r.TotalG, r.ScanTotalG)
		if err != nil {
			fail(c, http.StatusBadRequest, err.Error())
			return
		}
		if len(res.NeedGrams) > 0 {
			if r.Save {
				fail(c, http.StatusUnprocessableEntity, "Informe os gramas de: "+strings.Join(res.NeedGrams, ", ")+".")
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "need_grams", "need_grams": res.NeedGrams, "result": res})
			return
		}
		if name == "" {
			parts := []string{}
			for _, it := range res.Items {
				if len(parts) < 3 {
					parts = append(parts, strings.ToLower(it.Name[:1])+it.Name[1:])
				}
			}
			for _, fr := range res.Free {
				if len(parts) < 3 {
					parts = append(parts, fr.Name)
				}
			}
			name = cleanText(strings.Join(parts, ", "), 80)
			if name != "" {
				name = strings.ToUpper(name[:1]) + name[1:]
			}
		}
	default:
		fail(c, http.StatusBadRequest, "Modo inválido.")
		return
	}

	if !r.Save {
		c.JSON(http.StatusOK, gin.H{"status": "preview", "result": res, "needs_ai": len(res.Free) > 0})
		return
	}
	if name == "" {
		name = "Refeição"
	}

	ctx := c.Request.Context()
	// Itens fora da tabela: a IA estima só esses, sob o mesmo limite das fotos.
	if len(res.Free) > 0 {
		id, ok, err := h.reserveAICalc(ctx, u.ID, u.Email)
		if err != nil {
			fail(c, http.StatusInternalServerError, "Erro ao processar. Tente novamente.")
			return
		}
		if !ok {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Itens fora da tabela dependem de IA e o limite é o mesmo das suas fotos. Escolha um item da lista ou tente mais tarde.", "code": "calc_ai_limit"})
			return
		}
		release := func() {
			h.pool.Exec(context.Background(), `DELETE FROM photo_analyses WHERE id=$1 AND status='pending'`, id)
		}
		descs := make([]string, 0, len(res.Free))
		for _, fr := range res.Free {
			descs = append(descs, fmt.Sprintf("%g g de %s", fr.Grams, cleanText(fr.Name, 60)))
		}
		actx, cancel := context.WithTimeout(ctx, 40*time.Second)
		defer cancel()
		type out struct {
			r   *domain.GeminiResponseSchema
			err error
		}
		ch := make(chan out, 1)
		go func() {
			rr, e := h.mealService.ProcessMealText(strings.Join(descs, "; "), "pt-BR")
			ch <- out{rr, e}
		}()
		var o out
		select {
		case o = <-ch:
		case <-actx.Done():
			o.err = gemini.ErrUpstream
		}
		if o.err != nil || o.r == nil || len(o.r.Items) == 0 || o.r.MealSummary.TotalCalories <= 0 {
			release()
			fail(c, http.StatusBadGateway, "Não consegui calcular os itens fora da tabela agora. Escolha um item da lista ou tente de novo.")
			return
		}
		for _, it := range o.r.Items {
			res.Items = append(res.Items, catalog.ItemOut{Name: it.Name, Grams: it.EstimatedWeightG, Kcal: it.Calories, ProteinG: it.ProteinG, CarbsG: it.CarbsG, FatG: it.FatG, Origin: "ia"})
			res.Kcal += it.Calories
			res.ProteinG += it.ProteinG
			res.CarbsG += it.CarbsG
			res.FatG += it.FatG
		}
		res.Free = nil
		res.Estimated = true
		res.Reasons = append(res.Reasons, "itens fora da tabela estimados pela IA")
		h.pool.Exec(ctx, `UPDATE photo_analyses SET status='ok' WHERE id=$1`, id)
	}

	conf := "ALTO"
	if res.Estimated {
		conf = "MEDIO"
	}
	note := "Calculado pela tabela TACO com o que você confirmou."
	if len(res.Reasons) > 0 {
		note += " Estimativa: " + strings.Join(res.Reasons, "; ") + "."
	}
	if len(notes) > 0 {
		note += " " + strings.Join(notes, " ")
	}
	schema := &domain.GeminiResponseSchema{}
	schema.MealSummary.Name = name
	schema.MealSummary.TotalCalories = res.Kcal
	schema.MealSummary.TotalProteinG = res.ProteinG
	schema.MealSummary.TotalCarbsG = res.CarbsG
	schema.MealSummary.TotalFatG = res.FatG
	schema.MealSummary.ConfidenceLevel = conf
	schema.MealSummary.Notes = cleanText(note, 400)
	for _, it := range res.Items {
		schema.Items = append(schema.Items, domain.MealItem{Name: it.Name, EstimatedWeightG: it.Grams, Calories: it.Kcal, ProteinG: it.ProteinG, CarbsG: it.CarbsG, FatG: it.FatG})
	}
	mealID, err := h.saveMeal(ctx, u.ID, mealType, schema)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar a refeição. Tente novamente.")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"meal_id":   mealID,
		"meal_type": mealType,
		"result":    res,
		"data":      gin.H{"meal_summary": schema.MealSummary, "items": schema.Items},
	})
}
