package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/faabio3131/app-nutri/backend/internal/application"
	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/database"
	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/http/handlers"
	"github.com/faabio3131/app-nutri/backend/internal/interfaces/middlewares"
	"github.com/gin-gonic/gin"
)

func main() {
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL é obrigatória")
	}
	ctx := context.Background()
	pool, err := database.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("banco: %v", err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrações: %v", err)
	}

	router := gin.New()
	router.Use(gin.Recovery(), gin.LoggerWithConfig(gin.LoggerConfig{SkipPaths: []string{"/api/v1/health"}}), middlewares.AccessLog(os.Getenv("ACCESS_LOG_DIR")))
	// O proxy (Nginx Proxy Manager) está na rede Docker privada: só ele pode informar o IP real do cliente.
	router.SetTrustedProxies([]string{"172.16.0.0/12", "10.0.0.0/8", "192.168.0.0/16", "127.0.0.1"})

	allowedOrigin := os.Getenv("CORS_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}
	router.Use(func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", allowedOrigin)
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Methods", "POST, GET, PUT, PATCH, DELETE, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		h.Set("Access-Control-Max-Age", "600")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "no-store")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	quota := application.NewQuotaService(pool)
	mealService := application.NewMealService(gemini.NewClient())
	api := handlers.NewAPIHandler(mealService, pool, quota)
	auth := middlewares.RequireAuth(pool)
	signupMax := 5
	if v, err := strconv.Atoi(os.Getenv("SIGNUP_LIMIT_PER_HOUR")); err == nil && v > 0 {
		signupMax = v
	}
	signupLimit := middlewares.NewLimiter(signupMax, time.Hour)
	loginLimit := middlewares.NewLimiter(30, 15*time.Minute)
	calcLimit := middlewares.NewLimiter(120, time.Minute)
	forgotLimit := middlewares.NewLimiter(10, 15*time.Minute)
	textLimit := middlewares.NewLimiter(30, time.Minute)
	mealCalcLimit := middlewares.NewLimiter(120, time.Minute) // prévia ao vivo na tela do prato

	v1 := router.Group("/api/v1")
	{
		v1.GET("/health", func(c *gin.Context) {
			pctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(pctx); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db_down"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "online", "service": "app-nutri-api"})
		})
		v1.POST("/auth/signup", signupLimit.ByIP(), api.Signup)
		v1.POST("/auth/login", loginLimit.ByIP(), api.Login)
		v1.GET("/config", api.Config)
		v1.POST("/auth/forgot", forgotLimit.ByIP(), api.ForgotPassword)
		v1.POST("/auth/reset", forgotLimit.ByIP(), api.ResetPassword)
		v1.POST("/webhooks/cakto", api.HandleCaktoWebhook)

		priv := v1.Group("/", auth)
		priv.GET("/me", api.Me)
		priv.POST("/auth/logout", api.Logout)
		priv.POST("/meals/analyze", api.AnalyzeMeal)
		priv.GET("/meals", api.ListMeals)
		priv.POST("/meals/text", textLimit.ByIP(), api.AnalyzeText)
		priv.PATCH("/meals/:id", api.UpdateMeal)
		priv.POST("/meals/scan", api.ScanMeal)
		priv.POST("/meals/calc", mealCalcLimit.ByIP(), api.CalcMeal)
		priv.GET("/catalog", api.Catalog)
		priv.DELETE("/meals/:id", api.DeleteMeal)
		priv.POST("/nutrition/calculate", calcLimit.ByIP(), api.CalculateTDEE)
		priv.POST("/workouts", calcLimit.ByIP(), api.RegisterWorkout)
		priv.GET("/workouts", api.ListWorkouts)
		priv.DELETE("/workouts/by-ref", api.DeleteWorkoutByRef)
		priv.DELETE("/workouts/:id", api.DeleteWorkout)
		priv.GET("/days/summary", api.DaySummary)
		priv.POST("/days/close", api.CloseDay)
		priv.GET("/history", api.History)
		priv.POST("/weight", calcLimit.ByIP(), api.LogWeight)
		priv.GET("/state", api.GetState)
		priv.PUT("/state", api.PutState)
		priv.GET("/account/export", api.ExportAccount)
		priv.DELETE("/account", api.DeleteAccount)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	go func() {
		log.Printf("App-Nutri API na porta %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("servidor: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(shutdown)
}
