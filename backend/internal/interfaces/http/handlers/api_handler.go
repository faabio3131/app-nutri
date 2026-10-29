package handlers

import (
    "io"
    "net/http"

    "github.com/faabio3131/app-nutri/backend/internal/application"
    "github.com/faabio3131/app-nutri/backend/internal/domain"
    "github.com/gin-gonic/gin"
)

type APIHandler struct {
    mealService *application.MealService
}

func NewAPIHandler(ms *application.MealService) *APIHandler {
    return &APIHandler{mealService: ms}
}

// AnalyzeMeal recebe a foto da câmera, aciona o Gemini e devolve as calorias e macros
func (h *APIHandler) AnalyzeMeal(c *gin.Context) {
    locale := c.GetHeader("Accept-Language")
    if locale == "" {
        locale = "pt-BR"
    }

    file, header, err := c.Request.FormFile("image")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Envie a foto do prato no campo 'image'"})
        return
    }
    defer file.Close()

    imageBytes, err := io.ReadAll(file)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Falha ao ler arquivo de imagem"})
        return
    }

    mimeType := header.Header.Get("Content-Type")
    if mimeType == "" {
        mimeType = "image/jpeg"
    }

    result, err := h.mealService.ProcessMealPhoto(imageBytes, mimeType, locale)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "status": "success",
        "locale": locale,
        "data":   result,
    })
}

// CalculateTDEE recebe peso atual, peso meta e dados biológicos e retorna calorias, macros e água
func (h *APIHandler) CalculateTDEE(c *gin.Context) {
    var bio domain.UserBiometrics
    if err := c.ShouldBindJSON(&bio); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Dados corporais inválidos: " + err.Error()})
        return
    }

    plan := domain.CalculateNutritionPlan(bio)
    c.JSON(http.StatusOK, gin.H{
        "status": "success",
        "data":   plan,
    })
}
