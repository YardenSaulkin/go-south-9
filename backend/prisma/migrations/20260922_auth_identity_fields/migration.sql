-- Identity fields captured by the sign-up form. They are nullable so that
-- existing seed scripts inserting users without them keep working. The API
-- requires all three on sign-up.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_number text;

-- One account per personal number. NULLs stay exempt, like users_email_lower_key.
CREATE UNIQUE INDEX IF NOT EXISTS users_personal_number_key
  ON users (personal_number);
