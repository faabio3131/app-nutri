// Package database abre o pool Postgres e aplica migrações versionadas embutidas no binário.
package database

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Connect abre o pool e espera o banco responder (até ~30 s).
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL inválida")
	}
	cfg.MaxConns = 12
	cfg.MinConns = 1
	cfg.MaxConnIdleTime = 5 * time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("abrir pool: %w", err)
	}
	var last error
	for i := 0; i < 15; i++ {
		pctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		last = pool.Ping(pctx)
		cancel()
		if last == nil {
			return pool, nil
		}
		time.Sleep(2 * time.Second)
	}
	pool.Close()
	return nil, fmt.Errorf("banco indisponível: %w", last)
}

// Migrate aplica, em ordem e uma única vez, cada arquivo NNN_nome.sql.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(727274)`); err != nil {
		return err
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock(727274)`)
	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`); err != nil {
		return err
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, name := range names {
		v, err := strconv.Atoi(strings.SplitN(name, "_", 2)[0])
		if err != nil {
			return fmt.Errorf("migração com nome inválido: %s", name)
		}
		var done bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, v).Scan(&done); err != nil {
			return err
		}
		if done {
			continue
		}
		sqlText, _ := migrationsFS.ReadFile("migrations/" + name)
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlText)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("migração %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, v); err != nil {
			tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
