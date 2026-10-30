package application

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TrialPhotos é o teste grátis vitalício por conta.
const TrialPhotos = 3

const tzName = "America/Sao_Paulo"

type planLimit struct {
	Monthly int
	Daily   int // 0 = sem teto diário
}

// Limites conforme a página de planos (landing).
var PlanLimits = map[string]planLimit{
	"essencial": {Monthly: 60},
	"pro":       {Monthly: 150, Daily: 5},
	"power":     {Monthly: 300, Daily: 10},
}

var (
	ErrQuota     = errors.New("limite atingido")
	ErrGlobalCap = errors.New("capacidade temporariamente esgotada")
)

// Usage descreve o direito de uso atual do usuário.
type Usage struct {
	Plan        string     `json:"plan"` // "teste" | essencial | pro | power
	Used        int        `json:"used"`
	Limit       int        `json:"limit"`
	DailyUsed   int        `json:"daily_used"`
	DailyLimit  int        `json:"daily_limit"`
	Remaining   int        `json:"remaining"`
	ActiveUntil *time.Time `json:"active_until,omitempty"`
	Canceled    bool       `json:"canceled,omitempty"`
}

type QuotaService struct {
	pool        *pgxpool.Pool
	globalDaily int
}

func NewQuotaService(pool *pgxpool.Pool) *QuotaService {
	g := 3000
	if v, err := strconv.Atoi(os.Getenv("GLOBAL_DAILY_ANALYSES")); err == nil && v > 0 {
		g = v
	}
	return &QuotaService{pool: pool, globalDaily: g}
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func compute(ctx context.Context, q queryer, userID, email string) (Usage, string, error) {
	u := Usage{Plan: "teste", Limit: TrialPhotos}
	var plan, status string
	var end *time.Time
	err := q.QueryRow(ctx, `SELECT plan, status, period_end FROM entitlements WHERE email=lower($1)`, email).Scan(&plan, &status, &end)
	paid := false
	if err == nil {
		if lim, ok := PlanLimits[plan]; ok && (status == "active" || status == "canceled") && end != nil && end.After(time.Now()) {
			paid = true
			u.Plan, u.Limit, u.DailyLimit = plan, lim.Monthly, lim.Daily
			u.ActiveUntil = end
			u.Canceled = status == "canceled"
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return u, "", err
	}
	if paid {
		if err := q.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND status IN ('ok','pending') AND source='plan'
			AND date_trunc('month', created_at AT TIME ZONE $2) = date_trunc('month', now() AT TIME ZONE $2)`, userID, tzName).Scan(&u.Used); err != nil {
			return u, "", err
		}
		if u.DailyLimit > 0 {
			if err := q.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND status IN ('ok','pending') AND source='plan'
				AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`, userID, tzName).Scan(&u.DailyUsed); err != nil {
				return u, "", err
			}
		}
		u.Remaining = u.Limit - u.Used
		if u.DailyLimit > 0 && u.DailyLimit-u.DailyUsed < u.Remaining {
			u.Remaining = u.DailyLimit - u.DailyUsed
		}
		if u.Remaining < 0 {
			u.Remaining = 0
		}
		return u, "plan", nil
	}
	if err := q.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE user_id=$1 AND status IN ('ok','pending') AND source='trial'`, userID).Scan(&u.Used); err != nil {
		return u, "", err
	}
	u.Remaining = max(0, u.Limit-u.Used)
	return u, "trial", nil
}

// Summary devolve o uso atual sem reservar nada.
func (s *QuotaService) Summary(ctx context.Context, userID, email string) (Usage, error) {
	u, _, err := compute(ctx, s.pool, userID, email)
	return u, err
}

// Reserve confere os limites e reserva 1 foto de forma atômica (lock por usuário).
// Quem chama deve chamar Confirm (sucesso) ou Release (falha) — falha não consome cota.
func (s *QuotaService) Reserve(ctx context.Context, userID, email string) (string, Usage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", Usage{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, userID); err != nil {
		return "", Usage{}, err
	}
	// reservas esquecidas (queda no meio da análise) deixam de contar após 3 min
	if _, err := tx.Exec(ctx, `DELETE FROM photo_analyses WHERE user_id=$1 AND status='pending' AND created_at < now() - interval '3 minutes'`, userID); err != nil {
		return "", Usage{}, err
	}
	var today int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM photo_analyses WHERE status IN ('ok','pending') AND created_at > now() - interval '24 hours'`).Scan(&today); err != nil {
		return "", Usage{}, err
	}
	if today >= s.globalDaily {
		return "", Usage{}, ErrGlobalCap
	}
	u, source, err := compute(ctx, tx, userID, email)
	if err != nil {
		return "", u, err
	}
	if u.Remaining <= 0 {
		return "", u, ErrQuota
	}
	var id string
	if err := tx.QueryRow(ctx, `INSERT INTO photo_analyses(user_id, source) VALUES($1,$2) RETURNING id`, userID, source).Scan(&id); err != nil {
		return "", u, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", u, err
	}
	u.Used++
	u.Remaining--
	return id, u, nil
}

func (s *QuotaService) Confirm(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE photo_analyses SET status='ok' WHERE id=$1`, id)
	return err
}

func (s *QuotaService) Release(ctx context.Context, id string) {
	if _, err := s.pool.Exec(ctx, `DELETE FROM photo_analyses WHERE id=$1 AND status='pending'`, id); err != nil {
		fmt.Printf("aviso: liberar reserva %s: %v\n", id, err)
	}
}
