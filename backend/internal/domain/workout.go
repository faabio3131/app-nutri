package domain

import "math"

// WorkoutRequest representa os dados enviados pelo cliente para registar um treino ou caminhada.
type WorkoutRequest struct {
	ActivityType string  `json:"activity_type"` // ex: "caminhada", "musculacao", "corrida", "bicicleta"
	DurationMin  int     `json:"duration_min"`  // duração em minutos
	Intensity    string  `json:"intensity"`     // "leve", "moderada", "intensa"
	WeightKg     float64 `json:"weight_kg"`     // opcional; sem ele usa o último peso registrado
	Ref          string  `json:"ref"`           // opcional; torna o registro idempotente (ex.: item da rotina no dia)
	Date         string  `json:"date"`          // opcional (AAAA-MM-DD); só hoje ou ontem
}

// DefaultWeightKg é usado quando não há nenhum peso informado (faixa média; marcado como estimativa na tela).
const DefaultWeightKg = 70.0

// met guarda o equivalente metabólico (Compêndio de Atividades Físicas) por atividade e intensidade.
var met = map[string][3]float64{
	//               leve  moderada intensa
	"caminhada":  {2.8, 3.8, 5.0},
	"corrida":    {8.0, 9.8, 11.8},
	"musculacao": {3.0, 4.5, 6.0},
	"bicicleta":  {4.0, 6.8, 10.0},
	"natacao":    {4.5, 6.0, 9.8},
	"danca":      {3.5, 5.0, 7.0},
	"funcional":  {4.5, 7.0, 10.0},
	"outro":      {3.0, 4.5, 6.5},
}

// Activities lista as atividades aceitas (ordem usada na tela).
var Activities = []string{"caminhada", "corrida", "musculacao", "bicicleta", "natacao", "danca", "funcional", "outro"}

func ValidActivity(a string) bool { _, ok := met[a]; return ok }

func intensityIndex(intensity string) int {
	switch intensity {
	case "leve":
		return 0
	case "intensa":
		return 2
	}
	return 1
}

// CalculateCaloriesBurned estima o gasto LÍQUIDO do exercício: (MET - 1) × peso × horas.
// Subtrai o 1 MET de repouso porque a meta diária já inclui o gasto basal.
func CalculateCaloriesBurned(activity string, durationMin int, intensity string, weightKg float64) int {
	m, ok := met[activity]
	if !ok {
		m = met["outro"]
	}
	if weightKg < 30 || weightKg > 300 {
		weightKg = DefaultWeightKg
	}
	net := m[intensityIndex(intensity)] - 1
	if net < 0 {
		net = 0
	}
	return int(math.Round(net * weightKg * float64(durationMin) / 60.0))
}

// DayVerdict compara o saldo líquido (ingeridas - queimadas) com a meta, com tolerância de 5% (mín. 100 kcal).
func DayVerdict(netKcal, goalKcal int) string {
	tol := int(math.Max(100, math.Round(float64(goalKcal)*0.05)))
	switch d := netKcal - goalKcal; {
	case d < -tol:
		return "deficit"
	case d > tol:
		return "superavit"
	}
	return "na_meta"
}

// ScaleFactorValid limita o ajuste de porção (¼x a 4x).
func ScaleFactorValid(f float64) bool { return f >= 0.25 && f <= 4 && f == f }
