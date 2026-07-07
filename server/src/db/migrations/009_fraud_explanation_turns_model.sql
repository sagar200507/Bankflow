DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='fraud_explanation_turns' AND column_name='model_used'
  ) THEN
    ALTER TABLE fraud_explanation_turns ADD COLUMN model_used VARCHAR(100);
  END IF;
END $$;
