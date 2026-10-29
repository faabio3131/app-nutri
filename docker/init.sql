-- Schema Inicial: App Nutri SaaS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    locale VARCHAR(5) DEFAULT 'pt-BR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_tier VARCHAR(20) DEFAULT 'starter', -- starter, pro, elite
    available_ai_credits INT DEFAULT 0,
    daily_scans_used INT DEFAULT 0,
    last_scan_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS nutrition_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_weight_kg NUMERIC(5,2) NOT NULL,
    target_weight_kg NUMERIC(5,2) NOT NULL,
    height_cm INT NOT NULL,
    birth_date DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    activity_level VARCHAR(20) NOT NULL,
    goal_type VARCHAR(20) NOT NULL,
    calorie_target INT NOT NULL,
    protein_target_g INT NOT NULL,
    carb_target_g INT NOT NULL,
    fat_target_g INT NOT NULL,
    water_goal_ml INT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    water_reminders_enabled BOOLEAN DEFAULT true,
    wake_up_time TIME DEFAULT '07:00',
    sleep_time TIME DEFAULT '23:00',
    meal_reminders JSONB DEFAULT '[]'::jsonb
);

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
