package handlers

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "net/http"
    "os"

    "github.com/gin-gonic/gin"
)

type CaktoWebhookPayload struct {
    Event string `json:"event"`
    Data  struct {
        OrderStatus string `json:"order_status"`
        Customer    struct {
            Email string `json:"email"`
            Name  string `json:"name"`
        } `json:"customer"`
        Item struct {
            ID   string `json:"product_id"`
            Name string `json:"product_name"`
        } `json:"item"`
    } `json:"data"`
}

func (h *APIHandler) HandleCaktoWebhook(c *gin.Context) {
    signature := c.GetHeader("X-Cakto-Signature")
    bodyBytes, err := c.GetRawData()
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Erro ao ler payload"})
        return
    }

    secret := os.Getenv("CAKTO_WEBHOOK_SECRET")
    if secret != "" {
        mac := hmac.New(sha256.New, []byte(secret))
        mac.Write(bodyBytes)
        expectedSig := hex.EncodeToString(mac.Sum(nil))
        if signature != expectedSig {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Assinatura de webhook invalida"})
            return
        }
    }

    var payload CaktoWebhookPayload
    if err := json.Unmarshal(bodyBytes, &payload); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalido"})
        return
    }

    if payload.Event == "order.approved" || payload.Data.OrderStatus == "paid" {
        email := payload.Data.Customer.Email
        product := payload.Data.Item.Name

        c.JSON(http.StatusOK, gin.H{
            "status":  "success",
            "message": "Plano ativado com sucesso para " + email,
            "product": product,
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "ignored", "event": payload.Event})
}
