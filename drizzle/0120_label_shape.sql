ALTER TABLE label_templates ADD COLUMN IF NOT EXISTS label_shape VARCHAR(30) NOT NULL DEFAULT 'rectangle';
ALTER TABLE label_templates ADD COLUMN IF NOT EXISTS corner_radius REAL;
