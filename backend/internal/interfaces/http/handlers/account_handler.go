package handlers

import (
	"net/http"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// ExportAccount entrega todos os dados do titular (LGPD art. 18, II e V).
func (h *APIHandler) ExportAccount(c *gin.Context) {
	u := middlewares.User(c)
	ctx := c.Request.Context()
	out := gin.H{"exported_at": time.Now().UTC(), "user": gin.H{"id": u.ID, "email": u.Email, "name": u.Name}}

	var createdAt time.Time
	var terms *time.Time
	var ver *string
	if err := h.pool.QueryRow(ctx, `SELECT created_at, terms_accepted_at, terms_version FROM users WHERE id=$1`, u.ID).Scan(&createdAt, &terms, &ver); err == nil {
		out["account"] = gin.H{"created_at": createdAt, "terms_accepted_at": terms, "terms_version": ver}
	}
	rows, err := h.pool.Query(ctx, `SELECT m.id::text, m.meal_type, COALESCE(m.name,''), m.total_calories::float8, m.total_protein_g::float8, m.total_carbs_g::float8, m.total_fat_g::float8,
		COALESCE(m.confidence_level,''), COALESCE(m.notes,''), m.consumed_at FROM meals m WHERE m.user_id=$1 ORDER BY m.consumed_at`, u.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao exportar.")
		return
	}
	meals := []gin.H{}
	for rows.Next() {
		var id, mt, name, conf, notes string
		var cal, p, cb, f float64
		var at time.Time
		if rows.Scan(&id, &mt, &name, &cal, &p, &cb, &f, &conf, &notes, &at) == nil {
			meals = append(meals, gin.H{"id": id, "meal_type": mt, "name": name, "calories": cal, "protein_g": p, "carbs_g": cb, "fat_g": f, "confidence": conf, "notes": notes, "consumed_at": at})
		}
	}
	rows.Close()
	out["meals"] = meals
	// Exercícios, peso e fechamentos do dia
	wk := []gin.H{}
	if r2, err := h.pool.Query(ctx, `SELECT activity, duration_min, intensity, calories_burned, performed_at FROM workout_logs WHERE user_id=$1 ORDER BY performed_at`, u.ID); err == nil {
		for r2.Next() {
			var a, in string
			var d, k int
			var at time.Time
			if r2.Scan(&a, &d, &in, &k, &at) == nil {
				wk = append(wk, gin.H{"activity": a, "duration_min": d, "intensity": in, "calories_burned": k, "performed_at": at})
			}
		}
		r2.Close()
	}
	out["workouts"] = wk
	out["weights"] = h.weights(ctx, u.ID, 3650)
	cl := []gin.H{}
	if r3, err := h.pool.Query(ctx, `SELECT day::text, consumed_kcal, burned_kcal, net_kcal, goal_kcal, verdict, closed_at FROM day_closures WHERE user_id=$1 ORDER BY day`, u.ID); err == nil {
		for r3.Next() {
			var d, v string
			var c1, b, n, g int
			var at time.Time
			if r3.Scan(&d, &c1, &b, &n, &g, &v, &at) == nil {
				cl = append(cl, gin.H{"day": d, "consumed_kcal": c1, "burned_kcal": b, "net_kcal": n, "goal_kcal": g, "verdict": v, "closed_at": at})
			}
		}
		r3.Close()
	}
	out["day_closures"] = cl
	var state []byte
	if h.pool.QueryRow(ctx, `SELECT data FROM user_state WHERE user_id=$1`, u.ID).Scan(&state) == nil {
		out["state"] = string(state)
	}
	var plan, status string
	var end *time.Time
	if h.pool.QueryRow(ctx, `SELECT plan, status, period_end FROM entitlements WHERE email=$1`, u.Email).Scan(&plan, &status, &end) == nil {
		out["subscription"] = gin.H{"plan": plan, "status": status, "period_end": end}
	}
	var photos int
	h.pool.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND status='ok'`, u.ID).Scan(&photos)
	out["photo_analyses_count"] = photos
	c.Header("Content-Disposition", `attachment; filename="meus-dados-nutrisnap.json"`)
	c.JSON(http.StatusOK, out)
}

// DeleteAccount apaga a conta e todos os dados pessoais (LGPD art. 18, VI), mediante senha.
func (h *APIHandler) DeleteAccount(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&r); err != nil || len(r.Password) == 0 || len(r.Password) > 72 {
		fail(c, http.StatusBadRequest, "Informe sua senha para confirmar.")
		return
	}
	var hash string
	if err := h.pool.QueryRow(c.Request.Context(), `SELECT COALESCE(password_hash,'') FROM users WHERE id=$1`, u.ID).Scan(&hash); err != nil ||
		bcrypt.CompareHashAndPassword([]byte(hash), []byte(r.Password)) != nil {
		fail(c, http.StatusForbidden, "Senha incorreta.")
		return
	}
	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao excluir.")
		return
	}
	defer tx.Rollback(ctx)
	// Direito de uso ainda vigente (contrato) é mantido até vencer; o resto sai agora.
	if _, err := tx.Exec(ctx, `DELETE FROM entitlements WHERE email=$1 AND (period_end IS NULL OR period_end <= now() OR status NOT IN ('active','canceled'))`, u.Email); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao excluir.")
		return
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id=$1`, u.ID); err != nil { // cascade: sessões, refeições, estado, análises
		fail(c, http.StatusInternalServerError, "Erro ao excluir.")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao excluir.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
