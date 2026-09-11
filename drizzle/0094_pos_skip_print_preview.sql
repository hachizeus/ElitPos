ALTER TABLE pos_profiles ADD COLUMN IF NOT EXISTS skip_print_preview boolean NOT NULL DEFAULT false;
