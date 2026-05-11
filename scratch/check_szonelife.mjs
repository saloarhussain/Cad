import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function getEnv(key) {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const lines = env.split('\n');
    for (const line of lines) {
      if (line.startsWith(`${key}=`)) {
        return line.split('=')[1].trim();
      }
    }
  } catch (e) {}
  return process.env[key];
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SECRET_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(email) {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    console.log('User found:', JSON.stringify({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      banned_until: user.banned_until,
      user_metadata: user.user_metadata
    }, null, 2));
  } else {
    console.log('User not found in Auth.');
  }
}

checkUser('szonelife@gmail.com');
