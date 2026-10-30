package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/mail"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func resetHash(t string) string {
	s := sha256.Sum256([]byte(t))
	return hex.EncodeToString(s[:])
}

func appURL() string {
	if u := strings.TrimRight(os.Getenv("APP_URL"), "/"); u != "" {
		return u
	}
	return "https://app.nutrisnapia.com.br"
}

// Config informa ao app quais recursos dependentes de configuração estão ligados.
func (h *APIHandler) Config(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"password_reset": mail.Enabled()})
}

// ForgotPassword sempre responde 200 (não revela se o e-mail tem cadastro). O link vale 30 minutos e é de uso único.
func (h *APIHandler) ForgotPassword(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		Email string `json:"email"`
	}
	ok := gin.H{"status": "ok"}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusOK, ok)
		return
	}
	email, valid := normEmail(r.Email)
	if !valid || !mail.Enabled() || !h.forgotByEmail.Allow(email) {
		c.JSON(http.StatusOK, ok)
		return
	}
	ctx := c.Request.Context()
	var id string
	if err := h.pool.QueryRow(ctx, `SELECT id::text FROM users WHERE lower(email)=$1`, email).Scan(&id); err != nil {
		c.JSON(http.StatusOK, ok)
		return
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		c.JSON(http.StatusOK, ok)
		return
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	h.pool.Exec(ctx, `DELETE FROM password_resets WHERE user_id=$1 AND (used_at IS NOT NULL OR expires_at < now())`, id)
	if _, err := h.pool.Exec(ctx, `INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES($1,$2,$3)`,
		resetHash(token), id, time.Now().Add(30*time.Minute)); err != nil {
		c.JSON(http.StatusOK, ok)
		return
	}
	link := appURL() + "/?reset=" + token
	go func() {
		body := "Olá!\r\n\r\nRecebemos um pedido para redefinir a senha da sua conta NutriSnap IA.\r\n" +
			"Para criar uma nova senha, abra o link abaixo (vale por 30 minutos e só pode ser usado uma vez):\r\n\r\n" + link +
			"\r\n\r\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\r\n\r\nNutriSnap IA"
		if err := mail.Send(email, "Redefinir sua senha - NutriSnap IA", body); err != nil {
			log.Printf("reset: falha ao enviar e-mail: %v", err)
		}
	}()
	c.JSON(http.StatusOK, ok)
}

// ResetPassword troca a senha com o token recebido por e-mail e encerra todas as sessões da conta.
func (h *APIHandler) ResetPassword(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<10)
	var r struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&r); err != nil || len(r.Token) < 20 || len(r.Token) > 100 {
		fail(c, http.StatusBadRequest, "Link inválido ou expirado. Peça um novo.")
		return
	}
	if len(r.Password) < 8 || len(r.Password) > 72 {
		fail(c, http.StatusBadRequest, "A senha deve ter de 8 a 72 caracteres.")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(r.Password), 10)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar a nova senha.")
		return
	}
	ctx := c.Request.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar a nova senha.")
		return
	}
	defer tx.Rollback(ctx)
	var userID string
	if err := tx.QueryRow(ctx, `UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING user_id::text`,
		resetHash(r.Token)).Scan(&userID); err != nil {
		fail(c, http.StatusBadRequest, "Link inválido ou expirado. Peça um novo.")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, string(hash), userID); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar a nova senha.")
		return
	}
	tx.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1`, userID)
	tx.Exec(ctx, `DELETE FROM password_resets WHERE user_id=$1 AND used_at IS NULL`, userID)
	if err := tx.Commit(ctx); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar a nova senha.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
