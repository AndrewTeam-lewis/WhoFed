-- Create table for granular reminder settings
CREATE TABLE IF NOT EXISTS reminder_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, schedule_id)
);

-- Enable RLS
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own reminder settings"
    ON reminder_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert or update their own reminder settings"
    ON reminder_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder settings"
    ON reminder_settings FOR UPDATE
    USING (auth.uid() = user_id);
