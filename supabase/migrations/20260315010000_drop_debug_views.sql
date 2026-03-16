-- Migration: Drop debug views that bypass RLS
-- These views were flagged as Security Definer Views by Supabase
-- Created at: 2026-03-15

DROP VIEW IF EXISTS public.debug_households_view;
DROP VIEW IF EXISTS public.debug_members_view;
