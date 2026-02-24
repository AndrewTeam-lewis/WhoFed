-- Add icon column to pets table (if not exists)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS icon text DEFAULT '🐾';

-- Optional: Backfill existing rows based on species (best effort)
UPDATE pets SET icon = '🐶' WHERE species = 'dog';
UPDATE pets SET icon = '🐕' WHERE species = 'dog-2';
UPDATE pets SET icon = '🐱' WHERE species = 'cat';
UPDATE pets SET icon = '🐈' WHERE species = 'cat-2';
UPDATE pets SET icon = '🐈‍⬛' WHERE species = 'cat-3';
UPDATE pets SET icon = '🐦' WHERE species = 'bird';
UPDATE pets SET icon = '🐹' WHERE species = 'hamster';
UPDATE pets SET icon = '🐰' WHERE species = 'rabbit';
UPDATE pets SET icon = '🐠' WHERE species = 'fish';
UPDATE pets SET icon = '🦎' WHERE species = 'iguana';
UPDATE pets SET icon = '🐍' WHERE species = 'snake';
UPDATE pets SET icon = '🐢' WHERE species = 'turtle';
