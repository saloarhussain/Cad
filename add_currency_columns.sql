-- Add currency columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "revenueCurrency" TEXT DEFAULT '$';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS "expenseCurrency" TEXT DEFAULT '₹';
