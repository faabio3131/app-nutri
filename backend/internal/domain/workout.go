package domain

// WorkoutRequest representa os dados enviados pelo cliente para registar um treino ou caminhada
type WorkoutRequest struct {
	UserID         string `json:"user_id"`
	ActivityType   string `json:"activity_type"`   // ex: "caminhada", "musculacao", "corrida", "bicicleta"
	DurationMin    int    `json:"duration_min"`    // duração em minutos
	Intensity      string `json:"intensity"`       // "leve", "moderada", "intensa"
	CaloriesBurned int    `json:"calories_burned"` // calculado ou informado
}

// CalculateCaloriesBurned calcula o gasto calórico estimado com base na atividade e duração
func CalculateCaloriesBurned(activity string, duration int, intensity string) int {
	// Taxa base de gasto calórico por minuto aproximada
	rate := 5.0 // padrão moderado

	switch activity {
	case "caminhada":
		rate = 4.0
	case "corrida":
		rate = 11.0
	case "musculacao":
		rate = 6.0
	case "bicicleta":
		rate = 8.0
	}

	// Ajuste por intensidade
	multiplier := 1.0
	if intensity == "leve" {
		multiplier = 0.8
	} else if intensity == "intensa" {
		multiplier = 1.3
	}

	return int(float64(duration) * rate * multiplier)
}
