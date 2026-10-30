package middlewares

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Limiter é uma janela deslizante em memória (suficiente para uma instância única).
type Limiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	max    int
	window time.Duration
}

func NewLimiter(max int, window time.Duration) *Limiter {
	l := &Limiter{hits: map[string][]time.Time{}, max: max, window: window}
	go func() {
		for range time.Tick(5 * time.Minute) {
			l.mu.Lock()
			cut := time.Now().Add(-l.window)
			for k, v := range l.hits {
				if len(v) == 0 || v[len(v)-1].Before(cut) {
					delete(l.hits, k)
				}
			}
			l.mu.Unlock()
		}
	}()
	return l
}

// Allow registra uma tentativa e informa se ainda está dentro do limite.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cut := now.Add(-l.window)
	h := l.hits[key]
	i := 0
	for i < len(h) && h[i].Before(cut) {
		i++
	}
	h = h[i:]
	if len(h) >= l.max {
		l.hits[key] = h
		return false
	}
	l.hits[key] = append(h, now)
	return true
}

// ByIP limita por IP do cliente.
func (l *Limiter) ByIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.Allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Muitas tentativas. Aguarde um pouco e tente de novo."})
			return
		}
		c.Next()
	}
}
