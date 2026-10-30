package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/application"
	"github.com/gin-gonic/gin"
)

// Envelope dos webhooks da Cakto: {secret, event, data}. data pode ser objeto (V1) ou lista (V2).
type caktoOrder struct {
	ID       json.RawMessage `json:"id"`
	Status   string          `json:"status"`
	Customer struct {
		Email string `json:"email"`
	} `json:"customer"`
	Product struct {
		ID      string `json:"id"`
		ShortID string `json:"short_id"`
	} `json:"product"`
	Offer struct {
		ID    string          `json:"id"`
		Price json.RawMessage `json:"price"`
	} `json:"offer"`
}

const (
	periodDays = 32 // ciclo mensal + folga; só eventos de pagamento estendem
	maxSkew    = 5 * time.Minute
)

// planFor mapeia a compra para o plano: primeiro CAKTO_PLAN_MAP (ids de oferta/produto), depois preço exato.
func planFor(o caktoOrder) string {
	for _, pair := range strings.Split(os.Getenv("CAKTO_PLAN_MAP"), ",") {
		kv := strings.SplitN(strings.TrimSpace(pair), "=", 2)
		if len(kv) != 2 || kv[0] == "" {
			continue
		}
		if kv[0] == o.Offer.ID || kv[0] == o.Product.ID || kv[0] == o.Product.ShortID {
			if _, ok := application.PlanLimits[kv[1]]; ok {
				return kv[1]
			}
		}
	}
	var price float64
	if len(o.Offer.Price) > 0 {
		s := strings.Trim(string(o.Offer.Price), `"`)
		price, _ = strconv.ParseFloat(s, 64)
	}
	// preço pode vir em reais (25.9) ou centavos (2590)
	for _, p := range []float64{price, price / 100} {
		switch math.Round(p * 100) {
		case 2590:
			return "essencial"
		case 4990:
			return "pro"
		case 7990:
			return "power"
		}
	}
	return ""
}

func verifyCakto(c *gin.Context, secret string, body []byte, bodySecret string) bool {
	sig := c.GetHeader("X-Cakto-Signature")
	ts := c.GetHeader("X-Cakto-Timestamp")
	if sig != "" && ts != "" {
		sec, err := strconv.ParseInt(ts, 10, 64)
		if err != nil || time.Since(time.Unix(sec, 0)).Abs() > maxSkew {
			return false
		}
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(ts + "."))
		mac.Write(body)
		want := "v1=" + hex.EncodeToString(mac.Sum(nil))
		return subtle.ConstantTimeCompare([]byte(sig), []byte(want)) == 1
	}
	return bodySecret != "" && subtle.ConstantTimeCompare([]byte(bodySecret), []byte(secret)) == 1
}

// HandleCaktoWebhook: valida a origem, é idempotente e SÓ o servidor libera/retira o plano.
func (h *APIHandler) HandleCaktoWebhook(c *gin.Context) {
	secret := os.Getenv("CAKTO_WEBHOOK_SECRET")
	if secret == "" { // falha fechada: sem segredo configurado nada é aceito
		fail(c, http.StatusServiceUnavailable, "Webhook não configurado.")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20))
	if err != nil {
		fail(c, http.StatusBadRequest, "Payload inválido.")
		return
	}
	var env struct {
		Secret string          `json:"secret"`
		Event  string          `json:"event"`
		Data   json.RawMessage `json:"data"`
	}
	if json.Unmarshal(body, &env) != nil || !verifyCakto(c, secret, body, env.Secret) {
		fail(c, http.StatusUnauthorized, "Assinatura inválida.")
		return
	}
	var orders []caktoOrder
	if len(env.Data) > 0 && env.Data[0] == '[' {
		json.Unmarshal(env.Data, &orders)
	} else {
		var o caktoOrder
		if json.Unmarshal(env.Data, &o) == nil {
			orders = append(orders, o)
		}
	}
	results := []string{}
	for _, o := range orders {
		results = append(results, h.applyCakto(c, env.Event, o))
	}
	for _, r := range results {
		if r == "erro" { // 5xx faz a Cakto reenviar; a idempotência evita efeito duplicado
			c.JSON(http.StatusInternalServerError, gin.H{"status": "retry", "results": results})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "results": results})
}

func (h *APIHandler) applyCakto(c *gin.Context, event string, o caktoOrder) string {
	email := strings.ToLower(strings.TrimSpace(o.Customer.Email))
	orderID := strings.Trim(string(o.ID), `"`)
	if email == "" || orderID == "" || orderID == "null" {
		return "ignored:sem_dados"
	}
	extend := map[string]bool{"purchase_approved": true, "subscription_created": true, "subscription_renewed": true,
		"subscription_late_recovered": true, "subscription_resumed": true}
	revoke := map[string]bool{"refund": true, "chargeback": true, "subscription_paused": true}
	if !extend[event] && !revoke[event] && event != "subscription_canceled" {
		return "ignored:" + event
	}
	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return "erro"
	}
	defer tx.Rollback(ctx)
	key := "cakto:" + event + ":" + orderID
	tag, err := tx.Exec(ctx, `INSERT INTO webhook_events(event_key, provider, event, email, outcome) VALUES($1,'cakto',$2,$3,'processing') ON CONFLICT DO NOTHING`, key, event, email)
	if err != nil {
		return "erro"
	}
	if tag.RowsAffected() == 0 {
		return "duplicado"
	}
	outcome := "ok"
	switch {
	case extend[event]:
		if event == "purchase_approved" && o.Status != "paid" {
			outcome = "ignored:status_" + o.Status
			break
		}
		plan := planFor(o)
		if plan == "" {
			outcome = "revisar:plano_desconhecido" // pago mas sem mapeamento: fica registrado para revisão manual
			log.Printf("cakto: compra %s sem plano mapeado (oferta %s)", orderID, o.Offer.ID)
			break
		}
		_, err = tx.Exec(ctx, `INSERT INTO entitlements(email, plan, status, period_end, last_order_id)
			VALUES($1,$2,'active', now() + make_interval(days => $3), $4)
			ON CONFLICT (email) DO UPDATE SET plan=EXCLUDED.plan, status='active',
			  period_end=EXCLUDED.period_end,
			  last_order_id=EXCLUDED.last_order_id, updated_at=now()`, email, plan, periodDays, orderID)
	case revoke[event]:
		status := "revoked"
		if event == "subscription_paused" {
			status = "paused"
		}
		_, err = tx.Exec(ctx, `UPDATE entitlements SET status=$2, period_end=now(), updated_at=now() WHERE email=$1`, email, status)
	case event == "subscription_canceled": // sem novas cobranças; mantém o acesso até o fim do período pago
		_, err = tx.Exec(ctx, `UPDATE entitlements SET status='canceled', updated_at=now() WHERE email=$1 AND status='active'`, email)
	}
	if err != nil {
		return "erro"
	}
	tx.Exec(ctx, `UPDATE webhook_events SET outcome=$2 WHERE event_key=$1`, key, outcome)
	if err := tx.Commit(ctx); err != nil {
		return "erro"
	}
	return outcome
}
