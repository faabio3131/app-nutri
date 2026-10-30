package middlewares

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const SessionDays = 30

type CurrentUser struct {
	ID    string
	Email string
	Name  string
}

const ctxKey = "current_user"

func User(c *gin.Context) CurrentUser {
	v, _ := c.Get(ctxKey)
	u, _ := v.(CurrentUser)
	return u
}

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// NewSession cria um token opaco (só o hash fica no banco).
func NewSession(c *gin.Context, pool *pgxpool.Pool, userID string) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	tok := base64.RawURLEncoding.EncodeToString(b)
	_, err := pool.Exec(c.Request.Context(),
		`INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2,$3)`,
		hashToken(tok), userID, time.Now().Add(SessionDays*24*time.Hour))
	return tok, err
}

func BearerToken(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

func RevokeSession(c *gin.Context, pool *pgxpool.Pool) {
	if t := BearerToken(c); t != "" {
		pool.Exec(c.Request.Context(), `DELETE FROM sessions WHERE token_hash=$1`, hashToken(t))
	}
}

// RequireAuth valida o Bearer token contra a tabela de sessões.
func RequireAuth(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		tok := BearerToken(c)
		if tok == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Faça login para continuar.", "code": "unauthorized"})
			return
		}
		var u CurrentUser
		err := pool.QueryRow(c.Request.Context(),
			`SELECT u.id::text, u.email, COALESCE(u.name,'') FROM sessions s JOIN users u ON u.id=s.user_id
			 WHERE s.token_hash=$1 AND s.expires_at > now()`, hashToken(tok)).Scan(&u.ID, &u.Email, &u.Name)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sessão expirada. Entre novamente.", "code": "unauthorized"})
			return
		}
		c.Set(ctxKey, u)
		c.Next()
	}
}
