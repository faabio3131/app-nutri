package domain

import "testing"

func TestCalculateCaloriesBurned(t *testing.T) {
	// caminhada moderada (MET 3,8) por 60 min, 70 kg: (3,8-1)*70*1h = 196 kcal líquidas
	if got := CalculateCaloriesBurned("caminhada", 60, "moderada", 70); got != 196 {
		t.Fatalf("caminhada 60min 70kg: esperado 196, veio %d", got)
	}
	// o peso muda o resultado
	if CalculateCaloriesBurned("corrida", 30, "moderada", 90) <= CalculateCaloriesBurned("corrida", 30, "moderada", 60) {
		t.Fatal("peso maior deve gastar mais")
	}
	// intensidade muda o resultado
	if CalculateCaloriesBurned("bicicleta", 30, "intensa", 70) <= CalculateCaloriesBurned("bicicleta", 30, "leve", 70) {
		t.Fatal("intensidade maior deve gastar mais")
	}
	// peso fora da faixa cai no padrão; atividade desconhecida cai em 'outro'
	if CalculateCaloriesBurned("xyz", 60, "moderada", 0) != CalculateCaloriesBurned("outro", 60, "moderada", DefaultWeightKg) {
		t.Fatal("atividade/peso inválidos devem usar os padrões")
	}
	if CalculateCaloriesBurned("caminhada", 0, "leve", 70) != 0 {
		t.Fatal("duração 0 gasta 0")
	}
}

func TestDayVerdict(t *testing.T) {
	cases := []struct {
		net, goal int
		want      string
	}{
		{1400, 2000, "deficit"},
		{1900, 2000, "na_meta"}, // dentro de ±100
		{2000, 2000, "na_meta"},
		{2100, 2000, "na_meta"},
		{2101, 2000, "superavit"},
		{1900, 2000, "na_meta"},
		{1899, 2000, "deficit"},
		{2860, 3000, "na_meta"}, // tolerância 5% = 150
		{2849, 3000, "deficit"},
		{2800, 3000, "deficit"},
		{-300, 2000, "deficit"}, // queimou mais do que comeu
	}
	for _, c := range cases {
		if got := DayVerdict(c.net, c.goal); got != c.want {
			t.Errorf("DayVerdict(%d,%d)=%s, esperado %s", c.net, c.goal, got, c.want)
		}
	}
}

func TestScaleFactorValid(t *testing.T) {
	for _, f := range []float64{0.25, 0.5, 1, 1.5, 4} {
		if !ScaleFactorValid(f) {
			t.Errorf("%v deveria ser válido", f)
		}
	}
	for _, f := range []float64{0, 0.1, 4.01, -1} {
		if ScaleFactorValid(f) {
			t.Errorf("%v deveria ser inválido", f)
		}
	}
}
