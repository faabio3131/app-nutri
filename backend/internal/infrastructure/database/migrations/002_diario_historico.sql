-- Fase upgrade: exercícios avulsos, peso, fechamento do dia e recuperação de senha. Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS workout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activity VARCHAR(30) NOT NULL,
    duration_min INT NOT NULL CHECK (duration_min BETWEEN 1 AND 600),
    intensity VARCHAR(10) NOT NULL,
    calories_burned INT NOT NULL CHECK (calories_burned >= 0),
    weight_kg NUMERIC(5,1),
    ref TEXT
);
CREATE INDEX IF NOT EXISTS workout_logs_user_time_idx ON workout_logs (user_id, performed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_user_ref_idx ON workout_logs (user_id, ref) WHERE ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS weight_logs (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_on DATE NOT NULL,
    weight_kg NUMERIC(5,1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, logged_on)
);

CREATE TABLE IF NOT EXISTS day_closures (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    consumed_kcal INT NOT NULL,
    burned_kcal INT NOT NULL,
    net_kcal INT NOT NULL,
    goal_kcal INT NOT NULL,
    protein_g INT NOT NULL,
    carbs_g INT NOT NULL,
    fat_g INT NOT NULL,
    protein_goal_g INT NOT NULL,
    carb_goal_g INT NOT NULL,
    fat_goal_g INT NOT NULL,
    water_ml INT NOT NULL DEFAULT 0,
    water_goal_ml INT NOT NULL DEFAULT 0,
    verdict VARCHAR(12) NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);
