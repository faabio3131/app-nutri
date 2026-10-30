package application

import (
	"github.com/faabio3131/app-nutri/backend/internal/domain"
	"github.com/faabio3131/app-nutri/backend/internal/infrastructure/gemini"
)

type MealService struct {
	geminiClient *gemini.Client
}

func NewMealService(gClient *gemini.Client) *MealService {
	return &MealService{
		geminiClient: gClient,
	}
}

func (s *MealService) ProcessMealPhoto(imageBytes []byte, mimeType string, locale string) (*domain.GeminiResponseSchema, error) {
	return s.geminiClient.AnalyzeMealImage(imageBytes, mimeType, locale)
}

func (s *MealService) ProcessMealText(text string, locale string) (*domain.GeminiResponseSchema, error) {
	return s.geminiClient.AnalyzeMealText(text, locale)
}
