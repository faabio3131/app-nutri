-- Aditiva sobre docker/init.sql (que já criou users, meals, meal_items...). Idempotente.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    locale VARCHAR(5) DEFAULT 'pt-BR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    meal_type VARCHAR(50) NOT NULL,
    image_url TEXT,
    total_calories NUMERIC(6,2) NOT NULL,
    total_protein_g NUMERIC(6,2) NOT NULL,
    total_carbs_g NUMERIC(6,2) NOT NULL,
    total_fat_g NUMERIC(6,2) NOT NULL,
    confidence_level VARCHAR(20),
    notes TEXT,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL,
    estimated_weight_g NUMERIC(6,2) NOT NULL,
    calories NUMERIC(6,2) NOT NULL,
    protein_g NUMERIC(6,2) NOT NULL,
    carbs_g NUMERIC(6,2) NOT NULL,
    fat_g NUMERIC(6,2) NOT NULL
);
ALTER TABLE meals ADD COLUMN IF NOT EXISTS name VARCHAR(255);
CREATE INDEX IF NOT EXISTS meals_user_consumed_idx ON meals (user_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS meal_items_meal_idx ON meal_items (meal_id);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Direito de uso comprado (Cakto). Chave = e-mail da compra; vale para o usuário de mesmo e-mail.
CREATE TABLE IF NOT EXISTS entitlements (
    email VARCHAR(255) PRIMARY KEY,
    plan VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    period_end TIMESTAMPTZ,
    last_order_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    source VARCHAR(10) NOT NULL
);
CREATE INDEX IF NOT EXISTS photo_analyses_user_idx ON photo_analyses (user_id, created_at);
CREATE INDEX IF NOT EXISTS photo_analyses_day_idx ON photo_analyses (created_at);

CREATE TABLE IF NOT EXISTS webhook_events (
    event_key TEXT PRIMARY KEY,
    provider VARCHAR(20) NOT NULL,
    event VARCHAR(60) NOT NULL,
    email VARCHAR(255),
    outcome VARCHAR(40) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
