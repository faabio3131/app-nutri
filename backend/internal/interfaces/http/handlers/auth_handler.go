package handlers

import (
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
)

// TermsVersion identifica a versão dos Termos/Privacidade aceita no cadastro.
const TermsVersion = "2026-10-30"

// hash falso para igualar o tempo de resposta quando o e-mail não existe.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), 10)

type authReq struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	AcceptTerms bool   `json:"accept_terms"`
}

func normEmail(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s || len(s) > 254 || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return "", false
	}
	return s, true
}

func (h *APIHandler) authResponse(c *gin.Context, id, email, name string) {
	tok, err := middlewares.NewSession(c, h.pool, id)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Não foi possível iniciar a sessão.")
		return
	}
	usage, _ := h.quota.Summary(c.Request.Context(), id, email)
	c.JSON(http.StatusOK, gin.H{"token": tok, "user": gin.H{"id": id, "email": email, "name": name}, "usage": usage})
}

func (h *APIHandler) Signup(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var r authReq
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	email, ok := normEmail(r.Email)
	if !ok {
		fail(c, http.StatusBadRequest, "E-mail inválido.")
		return
	}
	if len(r.Password) < 8 || len(r.Password) > 72 {
		fail(c, http.StatusBadRequest, "A senha deve ter de 8 a 72 caracteres.")
		return
	}
	if !r.AcceptTerms {
		fail(c, http.StatusBadRequest, "É preciso aceitar os Termos de Uso e a Política de Privacidade.")
		return
	}
	name := strings.TrimSpace(r.Name)
	if len([]rune(name)) > 120 {
		name = string([]rune(name)[:120])
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(r.Password), 10)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao criar a conta.")
		return
	}
	var id string
	err = h.pool.QueryRow(c.Request.Context(),
		`INSERT INTO users(email, name, password_hash, terms_accepted_at, terms_version) VALUES($1,$2,$3,now(),$4) RETURNING id::text`,
		email, name, string(hash), TermsVersion).Scan(&id)
	if err != nil {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" {
			fail(c, http.StatusConflict, "Este e-mail já tem cadastro. Entre com sua senha.")
			return
		}
		fail(c, http.StatusInternalServerError, "Erro ao criar a conta.")
		return
	}
	h.authResponse(c, id, email, name)
}

func (h *APIHandler) Login(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var r authReq
	if err := c.ShouldBindJSON(&r); err != nil {
		fail(c, http.StatusBadRequest, "Dados inválidos.")
		return
	}
	email, ok := normEmail(r.Email)
	if !ok || len(r.Password) > 72 {
		fail(c, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	if !h.loginByEmail.Allow(email) {
		fail(c, http.StatusTooManyRequests, "Muitas tentativas para este e-mail. Aguarde 15 minutos.")
		return
	}
	var id, name, hash string
	err := h.pool.QueryRow(c.Request.Context(),
		`SELECT id::text, COALESCE(name,''), COALESCE(password_hash,'') FROM users WHERE lower(email)=$1`, email).Scan(&id, &name, &hash)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			fail(c, http.StatusInternalServerError, "Erro ao entrar.")
			return
		}
		bcrypt.CompareHashAndPassword(dummyHash, []byte(r.Password))
		fail(c, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(r.Password)) != nil {
		fail(c, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	h.authResponse(c, id, email, name)
}

func (h *APIHandler) Logout(c *gin.Context) {
	middlewares.RevokeSession(c, h.pool)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *APIHandler) Me(c *gin.Context) {
	u := middlewares.User(c)
	usage, err := h.quota.Summary(c.Request.Context(), u.ID, u.Email)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao consultar o plano.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": gin.H{"id": u.ID, "email": u.Email, "name": u.Name}, "usage": usage})
}

var _ = time.Now
