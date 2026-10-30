package domain

import "time"

type Meal struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	ImageURL        string     `json:"image_url"`
	TotalCalories   float64    `json:"total_calories"`
	TotalProteinG   float64    `json:"total_protein_g"`
	TotalCarbsG     float64    `json:"total_carbs_g"`
	TotalFatG       float64    `json:"total_fat_g"`
	ConfidenceLevel string     `json:"confidence_level"`
	ConsumedAt      time.Time  `json:"consumed_at"`
	Items           []MealItem `json:"items"`
}

type MealItem struct {
	Name             string  `json:"name"`
	EstimatedWeightG float64 `json:"estimated_weight_g"`
	Calories         float64 `json:"calories"`
	ProteinG         float64 `json:"protein_g"`
	CarbsG           float64 `json:"carbs_g"`
	FatG             float64 `json:"fat_g"`
}

type GeminiResponseSchema struct {
	MealSummary struct {
		Name            string  `json:"name"`
		TotalCalories   float64 `json:"total_calories"`
		TotalProteinG   float64 `json:"total_protein_g"`
		TotalCarbsG     float64 `json:"total_carbs_g"`
		TotalFatG       float64 `json:"total_fat_g"`
		ConfidenceLevel string  `json:"confidence_level"`
		Notes           string  `json:"notes"`
	} `json:"meal_summary"`
	Items []MealItem `json:"items"`
}
