-- SQL Script to change a user's email address in Supabase
-- Run this in the Supabase SQL Editor as a full script

DO $$
DECLARE
    -- REPLACE THESE VALUES:
    v_old_email text := 'aglewis1@yahoo.com';
    v_new_email text := 'aglewis1776@gmail.com';
BEGIN
    -- 1. Update auth.users (The login email)
    UPDATE auth.users 
    SET email = v_new_email, 
        updated_at = now(),
        email_confirmed_at = now() -- Optional: Auto-confirm the new email
    WHERE email = v_old_email;

    -- 2. Update public.profiles (The application data)
    UPDATE public.profiles
    SET email = v_new_email,
        updated_at = now()
    WHERE email = v_old_email;
    
    RAISE NOTICE 'Updated email from % to %', v_old_email, v_new_email;
END $$;
