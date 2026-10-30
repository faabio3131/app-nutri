package handlers

import (
	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/gin-gonic/gin"
	"net/http"
)

// RegisterWorkout processa o registo de uma atividade física e retorna as calorias gastas
func (h *APIHandler) RegisterWorkout(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var req domain.WorkoutRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dados de treino inválidos"})
		return
	}

	if req.DurationMin < 1 || req.DurationMin > 600 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Duração deve ficar entre 1 e 600 minutos"})
		return
	}
	req.CaloriesBurned = 0 // sempre calculado no servidor
	// Se não veio o valor calculado, calculamos com base no motor interno
	if req.CaloriesBurned == 0 {
		req.CaloriesBurned = domain.CalculateCaloriesBurned(req.ActivityType, req.DurationMin, req.Intensity)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Treino registado com sucesso",
		"data": gin.H{
			"activity_type":   req.ActivityType,
			"duration_min":    req.DurationMin,
			"intensity":       req.Intensity,
			"calories_burned": req.CaloriesBurned,
		},
	})
}
