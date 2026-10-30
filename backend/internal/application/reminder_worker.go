package application

import (
	"context"
	"log"
	"time"
)

type ReminderWorker struct {
	interval time.Duration
}

func NewReminderWorker(interval time.Duration) *ReminderWorker {
	return &ReminderWorker{interval: interval}
}

// Start inicia o loop em background (Goroutine) para disparar alertas de hidratação e refeições
func (w *ReminderWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Println("⏰ Worker de Alertas (Água & Refeições) iniciado em background")

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Worker de Alertas encerrado")
			return
		case t := <-ticker.C:
			w.processScheduledReminders(t)
		}
	}
}

func (w *ReminderWorker) processScheduledReminders(currentTime time.Time) {
	// Em produção: consulta usuários ativos na janela de horário (wake_up_time <-> sleep_time)
	// e envia Web Push / FCM para lembrete de hidratação e horário das refeições.
	_ = currentTime.Format("15:04")
}
