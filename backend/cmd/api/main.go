package main

import (
    "log"
    "net/http"
    "os"

    "github.com/faabio3131/app-nutri/backend/internal/application"
    "github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
    "github.com/faabio3131/app-nutri/backend/internal/interfaces/http/handlers"
    "github.com/gin-gonic/gin"
)

func main() {
    if os.Getenv("GIN_MODE") == "release" {
        gin.SetMode(gin.ReleaseMode)
    }

    router := gin.Default()

    // CORS restrito ao domínio do app (CORS_ORIGIN); "*" só no desenvolvimento local.
    allowedOrigin := os.Getenv("CORS_ORIGIN")
    if allowedOrigin == "" {
        allowedOrigin = "*"
    }

    // Middleware CORS para permitir chamadas do Frontend Next.js
    router.Use(func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
        c.Writer.Header().Set("Vary", "Origin")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept-Language")
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    })

    // Injeção de Dependências (Clean Architecture)
    geminiClient := gemini.NewClient()
    mealService := application.NewMealService(geminiClient)
    apiHandler := handlers.NewAPIHandler(mealService)

    v1 := router.Group("/api/v1")
    {
        v1.GET("/health", func(c *gin.Context) {
            c.JSON(http.StatusOK, gin.H{"status": "online", "service": "app-nutri-api"})
        })
        v1.POST("/meals/analyze", apiHandler.AnalyzeMeal)
        v1.POST("/nutrition/calculate", apiHandler.CalculateTDEE)
        v1.POST("/workouts", apiHandler.RegisterWorkout)
    }

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("🚀 App-Nutri API rodando na porta %s", port)
    if err := router.Run(":" + port); err != nil {
        log.Fatalf("Erro ao iniciar servidor: %v", err)
    }
}
