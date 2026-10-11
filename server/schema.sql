CREATE TABLE IF NOT EXISTS taxpayers (
  id BIGSERIAL PRIMARY KEY,
  sr_no INTEGER UNIQUE,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  sub_category TEXT NOT NULL DEFAULT '',
  financial_from_to TEXT NOT NULL DEFAULT '',
  current_year_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  arrears_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_date DATE,
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS taxpayers_business_name_idx ON taxpayers (business_name);
CREATE INDEX IF NOT EXISTS taxpayers_category_idx ON taxpayers (category);
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';
