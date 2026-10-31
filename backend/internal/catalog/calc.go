package catalog

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

// Densidade de referência (g por colher de sopa cheia) quando o alimento não tem medida documentada.
// Usada só para repartir o peso do prato; o resultado é marcado como estimativa.
const defaultCSchG = 25.0

const (
	maxItemG  = 3000.0
	maxPlateG = 5000.0
)

type ItemIn struct {
	FoodID string  `json:"food_id"`
	Name   string  `json:"name"`
	Grams  float64 `json:"grams"` // informado pelo usuário: fica fixo
	Share  float64 `json:"share"` // fração visual do prato (qualquer escala positiva)
	Qty    float64 `json:"qty"`   // unidades (ovo, fatia, fruta)
}

type ItemOut struct {
	FoodID    string  `json:"food_id"`
	Name      string  `json:"name"`
	Grams     float64 `json:"grams"`
	Kcal      float64 `json:"calories"`
	ProteinG  float64 `json:"protein_g"`
	CarbsG    float64 `json:"carbs_g"`
	FatG      float64 `json:"fat_g"`
	Fixed     bool    `json:"fixed"`  // peso fixo (porção da proteína, unidade ou informado)
	Origin    string  `json:"origin"` // "tabela" | "ia"
	NeedsFood bool    `json:"-"`
}

type Result struct {
	Items     []ItemOut `json:"items"`
	Kcal      float64   `json:"total_calories"`
	ProteinG  float64   `json:"total_protein_g"`
	CarbsG    float64   `json:"total_carbs_g"`
	FatG      float64   `json:"total_fat_g"`
	TotalG    float64   `json:"total_g"`
	Estimated bool      `json:"estimated"`            // true quando algum passo usou valor estimado
	Reasons   []string  `json:"reasons,omitempty"`    // por que é estimativa
	Free      []ItemIn  `json:"free,omitempty"`       // itens fora da tabela (precisam de IA para nutrientes)
	NeedGrams []string  `json:"need_grams,omitempty"` // itens que precisam de gramas
}

var ErrEmpty = errors.New("nenhum item para calcular")

func round1(v float64) float64 { return math.Round(v*10) / 10 }

func nutrients(f *Food, g float64) (k, p, c, fa float64) {
	m := g / 100
	return f.Per100g.Kcal * m, f.Per100g.ProteinG * m, f.Per100g.CarbsG * m, f.Per100g.FatG * m
}

// Plate calcula um prato. scanGuessG é o peso total que a IA viu (usado só se o usuário não informou o peso).
func Plate(items []ItemIn, totalG, scanGuessG float64) (*Result, error) {
	if len(items) == 0 {
		return nil, ErrEmpty
	}
	if totalG < 0 || totalG > maxPlateG {
		return nil, fmt.Errorf("peso total entre 1 e %d g", int(maxPlateG))
	}
	type slot struct {
		in    ItemIn
		food  *Food
		grams float64
		fixed bool
		flex  bool
	}
	res := &Result{}
	slots := make([]*slot, 0, len(items))
	var fixedSum float64
	seen := map[string]bool{}
	for _, in := range items {
		if in.Grams < 0 || in.Grams > maxItemG || in.Share < 0 || in.Qty < 0 || in.Qty > 50 {
			return nil, errors.New("quantidade inválida")
		}
		f, ok := FoodByID(in.FoodID)
		if !ok {
			name := strings.TrimSpace(in.Name)
			if in.Grams <= 0 {
				res.NeedGrams = append(res.NeedGrams, name)
				continue
			}
			res.Free = append(res.Free, ItemIn{Name: name, Grams: in.Grams})
			fixedSum += in.Grams
			continue
		}
		if seen[f.ID] {
			continue // o mesmo alimento duas vezes: vale o primeiro
		}
		seen[f.ID] = true
		s := &slot{in: in, food: f}
		switch {
		case in.Grams > 0:
			s.grams, s.fixed = in.Grams, true
		case f.UnitG > 0:
			q := in.Qty
			if q <= 0 {
				q = 1
			}
			s.grams, s.fixed = q*f.UnitG, true
		case f.FixedG > 0:
			s.grams, s.fixed = f.FixedG, true
		default:
			s.flex = true
		}
		if s.fixed {
			fixedSum += s.grams
		}
		slots = append(slots, s)
	}

	var flex []*slot
	for _, s := range slots {
		if s.flex {
			flex = append(flex, s)
		}
	}
	reason := func(r string) {
		res.Estimated = true
		for _, x := range res.Reasons {
			if x == r {
				return
			}
		}
		res.Reasons = append(res.Reasons, r)
	}
	if len(flex) > 0 {
		total := totalG
		if total <= 0 && scanGuessG > 0 {
			total = math.Min(scanGuessG, maxPlateG)
			reason("peso total do prato estimado pela IA (informe o peso para um cálculo mais certo)")
		}
		remaining := total - fixedSum
		if total > 0 && remaining >= float64(len(flex))*5 {
			var wsum float64
			ws := make([]float64, len(flex))
			for i, s := range flex {
				share := s.in.Share
				if share <= 0 {
					share = 1
				}
				d := s.food.CSchG
				if d <= 0 {
					d = defaultCSchG
					reason("densidade de alguns itens estimada")
				}
				ws[i] = share * d
				wsum += ws[i]
			}
			for i, s := range flex {
				s.grams = math.Min(remaining*ws[i]/wsum, maxItemG)
			}
		} else {
			if total > 0 {
				reason("o peso informado não cobre todos os itens; usei porções padrão")
			} else {
				reason("sem o peso total, usei porções padrão")
			}
			for _, s := range flex {
				if s.food.DefaultG <= 0 {
					res.NeedGrams = append(res.NeedGrams, s.food.Name)
					continue
				}
				s.grams = s.food.DefaultG
			}
		}
	}
	if len(res.NeedGrams) > 0 {
		return res, nil
	}
	for _, s := range slots {
		if s.grams <= 0 {
			continue
		}
		g := round1(math.Max(s.grams, 1))
		k, p, c, fa := nutrients(s.food, g)
		res.Items = append(res.Items, ItemOut{FoodID: s.food.ID, Name: s.food.Name, Grams: g, Kcal: round1(k), ProteinG: round1(p), CarbsG: round1(c), FatG: round1(fa), Fixed: s.fixed, Origin: "tabela"})
		if s.food.DensityEstimated && s.flex {
			reason("densidade de alguns itens estimada")
		}
	}
	for _, it := range res.Items {
		res.Kcal += it.Kcal
		res.ProteinG += it.ProteinG
		res.CarbsG += it.CarbsG
		res.FatG += it.FatG
		res.TotalG += it.Grams
	}
	for _, fr := range res.Free {
		res.TotalG += fr.Grams
	}
	return res, nil
}

// DrinkCalc calcula uma bebida: valor por 100 ml da tabela x ml. labelKcal100 (opcional) é o valor do rótulo.
func DrinkCalc(drinkID string, ml, labelKcal100 float64) (*Result, error) {
	d, ok := DrinkByID(drinkID)
	if !ok {
		return nil, errors.New("bebida desconhecida")
	}
	if !(ml >= 1 && ml <= 3000) {
		return nil, errors.New("volume entre 1 e 3000 ml")
	}
	if labelKcal100 < 0 || labelKcal100 > 900 {
		return nil, errors.New("valor do rótulo inválido")
	}
	m := ml / 100
	k, p, c, fa := d.Per100ml.Kcal, d.Per100ml.ProteinG, d.Per100ml.CarbsG, d.Per100ml.FatG
	if labelKcal100 > 0 {
		if k > 0 {
			r := labelKcal100 / k
			p, c, fa = p*r, c*r, fa*r
		} else {
			c = labelKcal100 / 4
		}
		k = labelKcal100
	}
	name := d.GroupLabel + " — " + d.Variant
	out := ItemOut{FoodID: d.ID, Name: name, Grams: round1(ml), Kcal: round1(k * m), ProteinG: round1(p * m), CarbsG: round1(c * m), FatG: round1(fa * m), Fixed: true, Origin: "tabela"}
	res := &Result{Items: []ItemOut{out}, Kcal: out.Kcal, ProteinG: out.ProteinG, CarbsG: out.CarbsG, FatG: out.FatG, TotalG: out.Grams}
	if labelKcal100 > 0 {
		res.Reasons = []string{"calorias do rótulo informado por você"}
	}
	return res, nil
}

// ParseComplement reconhece alimentos citados no texto livre do "Complemento" (ex.: "feijão preto por baixo, 2 ovos").
// É determinístico e não usa IA; o texto é só dado. Devolve os itens achados e o que sobrou do texto.
func ParseComplement(text string) ([]ItemIn, string) {
	toks := strings.Fields(Norm(text))
	type al struct {
		toks []string
		id   string
	}
	var aliases []al
	for _, f := range Foods {
		names := append([]string{f.Name}, f.Aliases...)
		for _, n := range names {
			if t := strings.Fields(Norm(n)); len(t) > 0 {
				aliases = append(aliases, al{t, f.ID})
			}
		}
	}
	sort.SliceStable(aliases, func(i, j int) bool { return len(aliases[i].toks) > len(aliases[j].toks) })
	num := func(s string) (float64, bool) {
		v, err := strconv.ParseFloat(s, 64)
		return v, err == nil && v > 0
	}
	var out []ItemIn
	var left []string
	used := map[string]bool{}
	for i := 0; i < len(toks); {
		matched := false
		for _, a := range aliases {
			n := len(a.toks)
			if i+n > len(toks) {
				continue
			}
			ok := true
			for k := 0; k < n; k++ {
				if toks[i+k] != a.toks[k] {
					ok = false
					break
				}
			}
			if !ok {
				continue
			}
			neg := i > 0 && (toks[i-1] == "nao" || toks[i-1] == "sem")
			matched = true
			if !neg && !used[a.id] {
				used[a.id] = true
				it := ItemIn{FoodID: a.id}
				f, _ := FoodByID(a.id)
				// "200 g de feijao" / "200g feijao" / "2 ovos"
				j := i - 1
				if j >= 0 && toks[j] == "de" {
					j--
				}
				if j >= 0 && (toks[j] == "g" || toks[j] == "gr" || toks[j] == "gramas" || toks[j] == "grama") && j >= 1 {
					if v, ok := num(toks[j-1]); ok && v <= maxItemG {
						it.Grams = v
					}
				} else if j >= 0 && strings.HasSuffix(toks[j], "g") {
					if v, ok := num(strings.TrimSuffix(toks[j], "g")); ok && v <= maxItemG {
						it.Grams = v
					}
				} else if j >= 0 && f != nil && f.UnitG > 0 {
					if v, ok := num(toks[j]); ok && v <= 20 {
						it.Qty = v
					}
				}
				out = append(out, it)
			}
			i += n
			break
		}
		if !matched {
			left = append(left, toks[i])
			i++
		}
	}
	return out, strings.Join(left, " ")
}
