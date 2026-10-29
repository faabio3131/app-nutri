package application

import (
    "errors"

    "github.com/faabio3131/app-nutri/backend/internal/domain"
    "github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
)

var ErrInsufficientCredits = errors.New("limite diário atingido: adquira um pacote avulso de créditos ou faça upgrade para o plano Pro/Elite")

type MealService struct {
    geminiClient *gemini.Client
}

func NewMealService(gClient *gemini.Client) *MealService {
    return &MealService{
        geminiClient: gClient,
    }
}

// CheckScanAllowance valida a regra dos 3 planos (Starter, Pro, Elite) e Créditos Avulsos
func (s *MealService) CheckScanAllowance(planTier string, dailyScansUsed int, availableCredits int) (useCredit bool, err error) {
    if planTier == "pro" || planTier == "elite" {
        return false, nil
    }
    // Plano Starter tem direito a 3 análises gratuitas por dia
    if dailyScansUsed < 3 {
        return false, nil
    }
    // Se estourou as 3 gratuitas, verifica se tem pacote avulso (Pay-As-You-Go)
    if availableCredits > 0 {
        return true, nil
    }
    return false, ErrInsufficientCredits
}

func (s *MealService) ProcessMealPhoto(imageBytes []byte, mimeType string, locale string) (*domain.GeminiResponseSchema, error) {
    return s.geminiClient.AnalyzeMealImage(imageBytes, mimeType, locale)
}
