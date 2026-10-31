// Package catalog guarda as tabelas de referência (alimentos e bebidas) e faz o cálculo nutricional.
// Os números vêm de fontes publicadas (TACO/IBGE/UFG) e estão em foods.json e drinks.json, gerados por tools/build_catalog.py.
// A IA só LÊ a foto; quem calcula é este pacote.
package catalog

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

//go:embed foods.json
var foodsJSON []byte

//go:embed drinks.json
var drinksJSON []byte

type Per struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

type Food struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Category         string   `json:"category"`
	Aliases          []string `json:"aliases"`
	Per100g          Per      `json:"per100g"`
	CSchG            float64  `json:"csch_g"`  // gramas por colher de sopa cheia (densidade)
	FixedG           float64  `json:"fixed_g"` // porção fixa (proteínas)
	DefaultG         float64  `json:"default_g"`
	UnitG            float64  `json:"unit_g"` // peso de 1 unidade (ovo, fatia, fruta)
	NeedsGrams       bool     `json:"needs_grams"`
	DensityEstimated bool     `json:"density_estimated"`
	Source           string   `json:"source"`
	MeasureSource    string   `json:"measure_source"`
}

type Drink struct {
	ID         string   `json:"id"`
	Group      string   `json:"group"`
	GroupLabel string   `json:"group_label"`
	Variant    string   `json:"variant"`
	Aliases    []string `json:"aliases"`
	Per100ml   Per      `json:"per100ml"`
	SugarFree  bool     `json:"sugar_free"`
	Source     string   `json:"source"`
}

var (
	Foods     []Food
	Drinks    []Drink
	foodByID  = map[string]*Food{}
	drinkByID = map[string]*Drink{}
)

func init() {
	if err := json.Unmarshal(foodsJSON, &Foods); err != nil {
		panic(fmt.Sprintf("catalog: foods.json inválido: %v", err))
	}
	if err := json.Unmarshal(drinksJSON, &Drinks); err != nil {
		panic(fmt.Sprintf("catalog: drinks.json inválido: %v", err))
	}
	for i := range Foods {
		foodByID[Foods[i].ID] = &Foods[i]
	}
	for i := range Drinks {
		drinkByID[Drinks[i].ID] = &Drinks[i]
	}
}

func FoodByID(id string) (*Food, bool)   { f, ok := foodByID[id]; return f, ok }
func DrinkByID(id string) (*Drink, bool) { d, ok := drinkByID[id]; return d, ok }

var stripAccents = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

// Norm minúsculas, sem acentos e sem pontuação, para comparar apelidos.
func Norm(s string) string {
	out, _, err := transform.String(stripAccents, strings.ToLower(s))
	if err != nil {
		out = strings.ToLower(s)
	}
	var b strings.Builder
	for _, r := range out {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// Prompt devolve a lista compacta (id: nome) usada para a IA escolher itens da tabela.
func PromptFoods() string {
	var b strings.Builder
	for _, f := range Foods {
		fmt.Fprintf(&b, "%s=%s; ", f.ID, f.Name)
	}
	return b.String()
}

func PromptDrinks() string {
	var b strings.Builder
	for _, d := range Drinks {
		fmt.Fprintf(&b, "%s=%s %s; ", d.ID, d.GroupLabel, d.Variant)
	}
	return b.String()
}
