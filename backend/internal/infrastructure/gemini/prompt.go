package gemini

import (
    "context"
    "fmt"
)

// GetMealAnalysisPrompt retorna o prompt estruturado com foco em pratos e bebidas brasileiras
func GetMealAnalysisPrompt() string {
    return `Analise esta imagem de refeição ou bebida com foco na culinária e hábitos brasileiros (ex: arroz, feijão, pão na chapa, café, sucos, carnes típicas). 
Identifique todos os itens visíveis, estime o peso em gramas ou o volume em ml de forma realista com base no recipiente, e calcule com precisão:
- Calorias totais (kcal)
- Proteínas (g)
- Carboidratos (g)
- Gorduras (g)

Retorne a resposta estritamente em formato JSON estruturado, sem textos adicionais.`
}
