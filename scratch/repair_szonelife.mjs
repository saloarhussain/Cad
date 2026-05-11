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

async function repairUser(email, password) {
  console.log(`Starting repair for ${email}...`);
  
  // 1. Create the Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: 'designer',
      full_name: 'Zeenat',
      onboarding_completed: true
    }
  });

  if (authError) {
    console.error('Auth Creation Error:', authError.message);
    return;
  }

  const newUserId = authData.user.id;
  console.log(`Auth account created with ID: ${newUserId}`);

  // 2. Update existing designer record to point to this new Auth ID
  const { error: dbError } = await supabase
    .from('designers')
    .update({ user_id: newUserId })
    .ilike('email', email);

  if (dbError) {
    console.error('Database Link Error:', dbError.message);
  } else {
    console.log('Successfully linked Designer Profile to new Auth account.');
  }
}

repairUser('szonelife@gmail.com', 'Designer@123');
