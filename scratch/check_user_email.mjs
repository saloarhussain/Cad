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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(email) {
  const { data: { user }, error } = await supabase.auth.admin.getUserByEmail(email);
  if (error) {
    console.error('Error fetching user:', error.message);
    return;
  }
  if (user) {
    console.log('User found:', JSON.stringify(user, null, 2));
  } else {
    console.log('User not found.');
  }
}

checkUser('szonelife@gmail.com');
