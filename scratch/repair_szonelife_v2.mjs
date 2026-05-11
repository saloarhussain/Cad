import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function getEnv(key) {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const lines = env.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${key}=`)) {
        return trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) {}
  return process.env[key];
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing Supabase Credentials in .env.local');
  process.exit(1);
}

// Clean URL (remove trailing slashes)
const cleanUrl = supabaseUrl.replace(/\/$/, '');

console.log(`Connecting to Supabase at: ${cleanUrl}`);

const supabase = createClient(cleanUrl, supabaseKey);

async function repairUser(email, password) {
  console.log(`Searching for designer profile: ${email}...`);
  
  // 1. Get existing designer record to preserve identity
  const { data: existing, error: fetchErr } = await supabase
    .from('designers')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (fetchErr) {
    console.error('Error fetching designer:', fetchErr.message);
    return;
  }

  if (!existing) {
    console.error('No designer record found for this email. Cannot repair.');
    return;
  }

  console.log(`Found designer: ${existing.fullName}. Re-creating login account...`);

  // 2. Create the Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: 'designer',
      full_name: existing.fullName || 'Professional Designer',
      onboarding_completed: true
    }
  });

  if (authError) {
    if (authError.message.includes('already exists')) {
        console.log('Account already exists in Auth. Attempting to link only...');
        // We need to find the user id
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (found) {
            await supabase.from('designers').update({ user_id: found.id }).eq('id', existing.id);
            console.log('Link fixed.');
            return;
        }
    }
    console.error('Auth Creation Error:', authError.message);
    return;
  }

  const newUserId = authData.user.id;
  console.log(`New Auth ID: ${newUserId}`);

  // 3. Link DB record to new Auth ID
  const { error: dbError } = await supabase
    .from('designers')
    .update({ user_id: newUserId })
    .eq('id', existing.id);

  if (dbError) {
    console.error('Database Link Error:', dbError.message);
  } else {
    console.log('--- REPAIR COMPLETE ---');
    console.log(`User: ${email}`);
    console.log(`Pass: ${password}`);
    console.log('The designer can now log in normally.');
  }
}

repairUser('szonelife@gmail.com', 'Designer@123');
