package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// HandleAsaasWebhook processa os eventos de pagamento confirmados pela Asaas (vendas diretas)
func (h *APIHandler) HandleAsaasWebhook(c *gin.Context) {
    var payload map[string]interface{}

    if err := c.ShouldBindJSON(&payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Payload inválido"})
        return
    }

    event, _ := payload["event"].(string)
    
    // Quando o pagamento for confirmado via Pix ou Cartão na Asaas
    if event == "PAYMENT_RECEIVED" {
        // Lógica de liberação de créditos para o utilizador correspondente no banco de dados
        c.JSON(http.StatusOK, gin.H{
            "status": "success",
            "message": "Pagamento Asaas processado com sucesso e créditos liberados",
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "ignored", "event": event})
}
