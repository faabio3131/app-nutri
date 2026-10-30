package handlers

import (
	"net/http"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/application"
	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type APIHandler struct {
	mealService  *application.MealService
	pool         *pgxpool.Pool
	quota        *application.QuotaService
	loginByEmail *middlewares.Limiter
}

func NewAPIHandler(ms *application.MealService, pool *pgxpool.Pool, q *application.QuotaService) *APIHandler {
	return &APIHandler{
		mealService:  ms,
		pool:         pool,
		quota:        q,
		loginByEmail: middlewares.NewLimiter(8, 15*time.Minute),
	}
}

func fail(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

// CalculateTDEE calcula calorias, macros e água a partir dos dados corporais (validados).
func (h *APIHandler) CalculateTDEE(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var bio domain.UserBiometrics
	if err := c.ShouldBindJSON(&bio); err != nil {
		fail(c, http.StatusBadRequest, "Dados corporais inválidos.")
		return
	}
	if bio.WeightKg < 30 || bio.WeightKg > 300 || bio.TargetWeight < 30 || bio.TargetWeight > 300 ||
		bio.HeightCm < 120 || bio.HeightCm > 230 || bio.Age < 18 || bio.Age > 100 {
		fail(c, http.StatusBadRequest, "Confira peso (30–300 kg), altura (120–230 cm) e idade (18–100).")
		return
	}
	plan := domain.CalculateNutritionPlan(bio)
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": plan})
}
