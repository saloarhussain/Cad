-- 1. Track Reward Points (CADONCE Points)
CREATE TABLE IF NOT EXISTS points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'earn', 'transfer', 'withdrawal', 'refund'
    status TEXT DEFAULT 'completed',
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Track Project Financials (Project Escrow)
CREATE TABLE IF NOT EXISTS project_escrow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    organization_id UUID REFERENCES auth.users(id),
    designer_id UUID, 
    amount NUMERIC NOT NULL, -- The 'expense' portion of the project
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'released', 'refunded'
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    released_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Add Escrow columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS escrow_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS escrow_id UUID;

-- 4. Enable RLS
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_escrow ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Users can view their own points history"
ON points_ledger FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Organizations can view their own project escrows"
ON project_escrow FOR SELECT
USING (auth.uid() = organization_id);

CREATE POLICY "Designers can view escrows where they are recipients"
ON project_escrow FOR SELECT
USING (auth.uid() = designer_id);
