package http

import (
    "github.com/gin-gonic/gin"
    "github.com/faabio3131/app-nutri/backend/internal/interfaces/http/handlers"
)

func RegisterRoutes(r *gin.Engine) {
    handler := handlers.NewAPIHandler()

    v1 := r.Group("/api/v1")
    {
        v1.GET("/health", handler.HealthCheck)
        v1.POST("/meals/analyze", handler.AnalyzeMeal-fm)
        v1.POST("/nutrition/calculate", handler.CalculateTDEE-fm)
        
        // Módulo de Treinos e Gasto Calórico
        v1.POST("/workouts", handler.RegisterWorkout)
        
        // Webhooks de Pagamento
        v1.POST("/webhook/cakto", handler.HandleCaktowebhook)
        v1.POST("/webhook/asaas", handler.HandleAsaasWebhook)
    }
}
