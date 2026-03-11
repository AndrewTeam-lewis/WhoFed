-- Auto-create household invite keys when a household is created

-- Function to generate a random invite key
CREATE OR REPLACE FUNCTION generate_household_key()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a new invite key for the household
    INSERT INTO household_keys (household_id, key_value)
    VALUES (
        NEW.id,
        lower(substr(md5(random()::text || clock_timestamp()::text), 1, 20))
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create key when household is created
DROP TRIGGER IF EXISTS create_household_key_on_insert ON households;
CREATE TRIGGER create_household_key_on_insert
    AFTER INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION generate_household_key();

-- Backfill keys for existing households that don't have one
INSERT INTO household_keys (household_id, key_value)
SELECT
    h.id,
    lower(substr(md5(random()::text || h.id::text || clock_timestamp()::text), 1, 20))
FROM households h
LEFT JOIN household_keys hk ON h.id = hk.household_id
WHERE hk.household_id IS NULL;
