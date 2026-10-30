package middlewares

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Marco Civil da Internet (Lei 12.965/2014, art. 15): provedores de aplicação guardam os registros de acesso por 6 meses, em sigilo.
// Guardamos 200 dias (~6,5 meses). Cada linha: data/hora UTC, IP, método, caminho (sem query string), status e id do usuário (se logado).
const accessLogRetention = 200 * 24 * time.Hour

type accessLogger struct {
	mu   sync.Mutex
	dir  string
	file *os.File
	name string
}

type accessLine struct {
	T      string `json:"t"`
	IP     string `json:"ip"`
	Method string `json:"m"`
	Path   string `json:"p"`
	Status int    `json:"s"`
	User   string `json:"u,omitempty"`
	UA     string `json:"ua,omitempty"`
}

// AccessLog grava os registros de acesso em dir (um arquivo por mês) e apaga os vencidos. dir vazio desativa.
func AccessLog(dir string) gin.HandlerFunc {
	if dir == "" {
		return func(c *gin.Context) { c.Next() }
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		log.Printf("accesslog: não foi possível criar %s: %v", dir, err)
		return func(c *gin.Context) { c.Next() }
	}
	l := &accessLogger{dir: dir}
	l.purge()
	go func() {
		for range time.Tick(24 * time.Hour) {
			l.purge()
		}
	}()
	return func(c *gin.Context) {
		c.Next()
		path := c.Request.URL.Path
		if path == "/api/v1/health" || c.Request.Method == "OPTIONS" {
			return
		}
		ua := c.Request.UserAgent()
		if len(ua) > 160 {
			ua = ua[:160]
		}
		now := time.Now().UTC()
		b, _ := json.Marshal(accessLine{T: now.Format(time.RFC3339), IP: c.ClientIP(), Method: c.Request.Method, Path: path, Status: c.Writer.Status(), User: User(c).ID, UA: ua})
		l.write(now, append(b, '\n'))
	}
}

func (l *accessLogger) write(now time.Time, line []byte) {
	l.mu.Lock()
	defer l.mu.Unlock()
	name := "access-" + now.Format("2006-01") + ".log"
	if l.file == nil || l.name != name {
		if l.file != nil {
			l.file.Close()
		}
		f, err := os.OpenFile(filepath.Join(l.dir, name), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o640)
		if err != nil {
			log.Printf("accesslog: %v", err)
			l.file = nil
			return
		}
		l.file, l.name = f, name
	}
	l.file.Write(line)
}

func (l *accessLogger) purge() {
	entries, err := os.ReadDir(l.dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), "access-") {
			continue
		}
		info, err := e.Info()
		if err == nil && time.Since(info.ModTime()) > accessLogRetention {
			os.Remove(filepath.Join(l.dir, e.Name()))
		}
	}
}
