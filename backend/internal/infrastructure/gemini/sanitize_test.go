package gemini

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/faabio3131/app-nutri/backend/internal/domain"
)

// Regressão: se a IA não devolve "items", o JSON enviado ao app não pode ter "items": null
// (o app faz items.map e quebra depois de a foto já ter sido cobrada).
func TestSanitizeScanItemsNuncaNull(t *testing.T) {
	for _, in := range []*domain.ScanResult{
		{Kind: "bebida", Name: "Suco"},
		{Kind: "prato", Name: "Prato"},
		{Kind: "prato", Name: "x", Items: []domain.ScanItem{{Name: ""}}},
	} {
		b, err := json.Marshal(sanitizeScan(in))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(b), `"items":null`) || strings.Contains(string(b), `"alternatives":null`) {
			t.Fatalf("JSON com null: %s", b)
		}
	}
}
