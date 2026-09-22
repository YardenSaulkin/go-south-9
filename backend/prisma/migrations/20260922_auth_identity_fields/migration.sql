-- Identity fields captured by the sign-up form. They are nullable so that
-- existing rows without them remain valid. The API requires them on sign-up.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_number text;

-- One account per personal number. PostgreSQL permits multiple NULL values.
CREATE UNIQUE INDEX IF NOT EXISTS users_personal_number_key
  ON users (personal_number);
