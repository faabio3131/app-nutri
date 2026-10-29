package domain

import "math"

type UserBiometrics struct {
    WeightKg      float64 `json:"weight_kg"`
    TargetWeight  float64 `json:"target_weight_kg"`
    HeightCm      float64 `json:"height_cm"`
    Age           int     `json:"age"`
    Gender        string  `json:"gender"`
    ActivityLevel string  `json:"activity_level"`
}

type NutritionTarget struct {
    TDEE           int `json:"tdee"`
    CalorieTarget  int `json:"calorie_target"`
    ProteinTargetG int `json:"protein_target_g"`
    CarbTargetG    int `json:"carb_target_g"`
    FatTargetG     int `json:"fat_target_g"`
    WaterGoalMl    int `json:"water_goal_ml"`
}

func CalculateNutritionPlan(bio UserBiometrics) NutritionTarget {
    bmr := (10 * bio.WeightKg) + (6.25 * bio.HeightCm) - (5 * float64(bio.Age))
    if bio.Gender == "male" {
        bmr += 5
    } else {
        bmr -= 161
    }

    multiplier := 1.2
    switch bio.ActivityLevel {
    case "light":
        multiplier = 1.375
    case "moderate":
        multiplier = 1.55
    case "intense":
        multiplier = 1.725
    }
    tdee := bmr * multiplier

    targetCalories := tdee
    if bio.TargetWeight < bio.WeightKg {
        targetCalories -= 500
    } else if bio.TargetWeight > bio.WeightKg {
        targetCalories += 350
    }

    proteinG := bio.WeightKg * 2.0
    fatG := bio.WeightKg * 0.9
    remainingCals := math.Max(targetCalories-((proteinG*4)+(fatG*9)), 200)
    carbG := remainingCals / 4
    waterMl := bio.WeightKg * 35

    return NutritionTarget{
        TDEE:           int(math.Round(tdee)),
        CalorieTarget:  int(math.Round(targetCalories)),
        ProteinTargetG: int(math.Round(proteinG)),
        CarbTargetG:    int(math.Round(carbG)),
        FatTargetG:     int(math.Round(fatG)),
        WaterGoalMl:    int(math.Round(waterMl)),
    }
}
