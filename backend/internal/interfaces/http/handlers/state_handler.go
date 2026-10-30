package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

const maxStateBytes = 64 << 10

// GetState devolve o estado pessoal (metas, água, rotina de treinos, horários de refeição).
func (h *APIHandler) GetState(c *gin.Context) {
	u := middlewares.User(c)
	var data json.RawMessage
	err := h.pool.QueryRow(c.Request.Context(), `SELECT data FROM user_state WHERE user_id=$1`, u.ID).Scan(&data)
	if err != nil {
		data = json.RawMessage(`{}`)
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// PutState grava o estado (JSON objeto, até 64 KB).
func (h *APIHandler) PutState(c *gin.Context) {
	u := middlewares.User(c)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxStateBytes+1024)
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil || len(raw) > maxStateBytes {
		fail(c, http.StatusRequestEntityTooLarge, "Dados grandes demais.")
		return
	}
	var obj map[string]json.RawMessage
	if json.Unmarshal(raw, &obj) != nil || obj == nil {
		fail(c, http.StatusBadRequest, "Formato inválido.")
		return
	}
	if _, err := h.pool.Exec(c.Request.Context(),
		`INSERT INTO user_state(user_id, data) VALUES($1,$2::jsonb)
		 ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`, u.ID, string(raw)); err != nil {
		fail(c, http.StatusInternalServerError, "Erro ao salvar.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
