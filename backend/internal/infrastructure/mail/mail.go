// Package mail envia e-mails transacionais por SMTP configurado por variáveis de ambiente.
// Sem SMTP_HOST configurado, Enabled() é falso e nada é enviado (o app esconde as telas que dependem de e-mail).
package mail

import (
	"crypto/tls"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

func Enabled() bool {
	return os.Getenv("SMTP_HOST") != "" && os.Getenv("SMTP_FROM") != ""
}

// Send envia um e-mail de texto simples (UTF-8). TLS é obrigatório (porta 465 implícito; demais, STARTTLS).
func Send(to, subject, body string) error {
	host, port := os.Getenv("SMTP_HOST"), os.Getenv("SMTP_PORT")
	user, pass, from := os.Getenv("SMTP_USER"), os.Getenv("SMTP_PASS"), os.Getenv("SMTP_FROM")
	if host == "" || from == "" {
		return fmt.Errorf("smtp não configurado")
	}
	if port == "" {
		port = "587"
	}
	if strings.ContainsAny(to+from, "\r\n") {
		return fmt.Errorf("endereço inválido")
	}
	addr := net.JoinHostPort(host, port)
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	var c *smtp.Client
	if port == "465" {
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return err
		}
		c, err = smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
	} else {
		conn, err := dialer.Dial("tcp", addr)
		if err != nil {
			return err
		}
		c, err = smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
		if ok, _ := c.Extension("STARTTLS"); !ok {
			c.Close()
			return fmt.Errorf("servidor SMTP sem STARTTLS")
		}
		if err := c.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			c.Close()
			return err
		}
	}
	defer c.Close()
	if user != "" {
		if err := c.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
			return err
		}
	}
	envFrom := from
	if i := strings.LastIndex(from, "<"); i >= 0 {
		envFrom = strings.TrimRight(from[i+1:], "> ")
	}
	if err := c.Mail(envFrom); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	msg := "From: " + from + "\r\nTo: " + to + "\r\nSubject: " + mime.QEncoding.Encode("utf-8", subject) +
		"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + body
	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
