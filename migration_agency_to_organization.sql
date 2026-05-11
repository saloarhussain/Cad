-- 1. Rename column in settings table
ALTER TABLE settings RENAME COLUMN agency_name TO organization_name;

-- 2. Rename column in project_escrow table
ALTER TABLE project_escrow RENAME COLUMN agency_id TO organization_id;

-- 3. Update RLS policies (if they use the old column names)
-- Note: Based on ledger_schema.sql, the policy for project_escrow uses agency_id
DROP POLICY IF EXISTS "Agencies can view their own project escrows" ON project_escrow;
CREATE POLICY "Organizations can view their own project escrows"
ON project_escrow FOR SELECT
USING (auth.uid() = organization_id);

-- 4. Update existing user metadata in auth.users
-- This is a Supabase specific operation. 
-- We want to rename 'agency_name' to 'organization_name' and 'role': 'agency' to 'role': 'organization'
UPDATE auth.users
SET raw_user_meta_data = 
  jsonb_set(
    jsonb_set(
      raw_user_meta_data - 'agency_name' - 'role',
      '{organization_name}', 
      COALESCE(raw_user_meta_data->'agency_name', '""')
    ),
    '{role}',
    CASE 
      WHEN raw_user_meta_data->>'role' = 'agency' THEN '"organization"'::jsonb
      ELSE COALESCE(raw_user_meta_data->'role', '"undetermined"'::jsonb)
    END
  )
WHERE raw_user_meta_data ? 'agency_name' OR raw_user_meta_data->>'role' = 'agency';
