package gemini

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "time"

    "github.com/faabio3131/app-nutri/backend/internal/domain"
)

type Client struct {
    apiKey     string
    model      string
    httpClient *http.Client
}

func NewClient() *Client {
    model := os.Getenv("GEMINI_MODEL")
    if model == "" {
        model = "gemini-2.0-flash"
    }
    return &Client{
        apiKey: os.Getenv("GEMINI_API_KEY"),
        model:  model,
        httpClient: &http.Client{
            Timeout: 25 * time.Second,
        },
    }
}

func (c *Client) AnalyzeMealImage(imageBytes []byte, mimeType string, locale string) (*domain.GeminiResponseSchema, error) {
    if c.apiKey == "" {
        return nil, fmt.Errorf("GEMINI_API_KEY não configurada no ambiente")
    }
    if locale == "" {
        locale = "pt-BR"
    }

    prompt := fmt.Sprintf(Você é um nutricionista especialista em visão computacional e análise volumétrica de alimentos.
Analise a foto do prato e retorne ESTRITAMENTE um objeto JSON válido seguindo esta estrutura exata:
{
  "meal_summary": {
    "name": "Nome resumido do prato",
    "total_calories": 0.0,
    "total_protein_g": 0.0,
    "total_carbs_g": 0.0,
    "total_fat_g": 0.0,
    "confidence_level": "ALTO, MEDIO ou BAIXO",
    "notes": "Observações sobre preparo, óleos ocultos ou dicas nutricionais"
  },
  "items": [
    {
      "name": "Nome do alimento",
      "estimated_weight_g": 0.0,
      "calories": 0.0,
      "protein_g": 0.0,
      "carbs_g": 0.0,
      "fat_g": 0.0
    }
  ]
}
Idioma obrigatório para todos os textos de retorno: %s. Use a tabela TACO/TBCA como referência nutricional., locale)

    b64Image := base64.StdEncoding.EncodeToString(imageBytes)

    payload := map[string]interface{}{
        "contents": []map[string]interface{}{
            {
                "parts": []map[string]interface{}{
                    {"text": prompt},
                    {
                        "inline_data": map[string]string{
                            "mime_type": mimeType,
                            "data":      b64Image,
                        },
                    },
                },
            },
        },
        "generationConfig": map[string]interface{}{
            "response_mime_type": "application/json",
            "temperature":        0.2,
        },
    }

    bodyBytes, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", c.model, c.apiKey)
    req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
    if err != nil {
        return nil, err
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("erro na API Gemini (status %d): %s", resp.StatusCode, string(respBody))
    }

    var rawResp struct {
        Candidates []struct {
            Content struct {
                Parts []struct {
                    Text string json:"text"
                } json:"parts"
            } json:"content"
        } json:"candidates"
    }

    if err := json.Unmarshal(respBody, &rawResp); err != nil {
        return nil, err
    }

    if len(rawResp.Candidates) == 0 || len(rawResp.Candidates[0].Content.Parts) == 0 {
        return nil, fmt.Errorf("resposta vazia do modelo Gemini")
    }

    jsonText := rawResp.Candidates[0].Content.Parts[0].Text
    var result domain.GeminiResponseSchema
    if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
        return nil, fmt.Errorf("falha ao decodificar JSON estruturado: %v", err)
    }

    return &result, nil
}
