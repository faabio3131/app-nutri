package domain

// ScanItem é um alimento que a IA leu na foto (sem calorias: quem calcula é a tabela).
type ScanItem struct {
	FoodID      string  `json:"food_id"`      // id da tabela, vazio se não encontrou
	Name        string  `json:"name"`         // nome lido
	VolumeShare float64 `json:"volume_share"` // fração visual do prato (0..1)
}

// ScanDrink é o que a IA leu de uma bebida.
type ScanDrink struct {
	DrinkID      string  `json:"drink_id"`
	Brand        string  `json:"brand"`
	VolumeML     float64 `json:"volume_ml"`
	LabelKcal100 float64 `json:"label_kcal_100ml"`
}

// ScanResult é a leitura da foto: itens, bebida e dúvidas. Não tem calorias.
type ScanResult struct {
	Kind            string     `json:"kind"` // prato | bebida
	Name            string     `json:"name"`
	Confidence      string     `json:"confidence"`
	EstimatedTotalG float64    `json:"estimated_total_g"`
	Items           []ScanItem `json:"items"`
	Drink           ScanDrink  `json:"drink"`
	Alternatives    []string   `json:"alternatives"`
}
