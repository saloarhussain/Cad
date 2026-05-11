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

async function searchAllUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  console.log(`Total users found: ${data.users.length}`);
  const szone = data.users.find(u => u.email.includes('szonelife'));
  if (szone) {
    console.log('Match found:', JSON.stringify(szone, null, 2));
  } else {
    console.log('No match for szonelife in the first 1000 users.');
  }
}

searchAllUsers();
