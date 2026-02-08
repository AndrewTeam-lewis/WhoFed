-- ============================================================================
-- Comprehensive Schema Information Export Script
-- Run this in Supabase SQL Editor to get complete schema details
-- ============================================================================

-- ============================================================================
-- 1. ALL TABLES WITH COLUMN DETAILS
-- ============================================================================
SELECT '=== TABLES AND COLUMNS ===' AS section;

SELECT
    t.table_name,
    c.column_name,
    c.ordinal_position AS position,
    c.data_type,
    c.column_default,
    c.is_nullable,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    CASE
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE ''
    END AS key_type,
    c.udt_name AS internal_type
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================================================
-- 2. PRIMARY KEYS
-- ============================================================================
SELECT '=== PRIMARY KEYS ===' AS section;

SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- 3. FOREIGN KEYS (RELATIONSHIPS)
-- ============================================================================
SELECT '=== FOREIGN KEYS ===' AS section;

SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
    AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 4. UNIQUE CONSTRAINTS
-- ============================================================================
SELECT '=== UNIQUE CONSTRAINTS ===' AS section;

SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 5. CHECK CONSTRAINTS
-- ============================================================================
SELECT '=== CHECK CONSTRAINTS ===' AS section;

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
SELECT '=== INDEXES ===' AS section;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
SELECT '=== RLS POLICIES ===' AS section;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd AS command,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 8. RLS ENABLED STATUS
-- ============================================================================
SELECT '=== RLS ENABLED STATUS ===' AS section;

SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================
SELECT '=== FUNCTIONS ===' AS section;

SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================
SELECT '=== TRIGGERS ===' AS section;

SELECT
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS event,
    action_timing AS timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 11. VIEWS
-- ============================================================================
SELECT '=== VIEWS ===' AS section;

SELECT
    table_name AS view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- 12. ENUMS (CUSTOM TYPES)
-- ============================================================================
SELECT '=== ENUM TYPES ===' AS section;

SELECT
    t.typname AS enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================================================
-- 13. COMPOSITE TYPES
-- ============================================================================
SELECT '=== COMPOSITE TYPES ===' AS section;

SELECT
    t.typname AS type_name,
    a.attname AS attribute_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnum AS position
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
JOIN pg_attribute a ON a.attrelid = t.typrelid
WHERE n.nspname = 'public'
    AND t.typtype = 'c'
    AND a.attnum > 0
    AND NOT a.attisdropped
ORDER BY t.typname, a.attnum;

-- ============================================================================
-- 14. TABLE SIZES AND ROW COUNTS
-- ============================================================================
SELECT '=== TABLE SIZES ===' AS section;

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 15. SEQUENCES
-- ============================================================================
SELECT '=== SEQUENCES ===' AS section;

SELECT
    schemaname,
    sequencename,
    last_value,
    increment_by,
    max_value,
    min_value,
    cycle
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
