-- Migration: Add is_admin column to profiles
-- Used to gate developer/admin tools visibility in the app
-- Created at: 2026-03-15

ALTER TABLE public.profiles
ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
