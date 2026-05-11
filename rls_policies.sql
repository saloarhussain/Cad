-- 1. Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE designers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies for 'projects'
CREATE POLICY "Users can only access their own projects"
ON projects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Create Policies for 'clients'
CREATE POLICY "Users can only access their own clients"
ON clients
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Create Policies for 'designers'
CREATE POLICY "Users can only access their own designers"
ON designers
FOR ALL
USING (auth.uid() = user_id OR (auth.jwt() ->> 'email') = email)
WITH CHECK (auth.uid() = user_id OR (auth.jwt() ->> 'email') = email);

-- 5. Create Policies for 'settings'
CREATE POLICY "Users can only access their own settings"
ON settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Ensure user_id defaults to auth.uid() on insert (optional but helpful)
ALTER TABLE projects ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE clients ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE designers ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE settings ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 7. Fix missing columns in 'settings' table
-- Run this in the Supabase SQL Editor if you see 400 Bad Request errors on the settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS subscription JSONB DEFAULT '{"plan": "Free", "status": "active"}'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- 8. Create OTP Verifications table for Secure Viewport
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '15 minutes'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS and restrict access to service role only for security
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
