import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettingsTable() {
  const { data, error } = await supabase.from('settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in settings table:', Object.keys(data[0]));
  } else {
    console.log('No records in settings table to check columns.');
    // Try to insert a dummy record to see if it fails
    const { error: insertError } = await supabase.from('settings').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        organization_name: 'Test',
        ownerName: 'Test',
        whatsapp: '123'
    });
    if (insertError) {
        console.error('Insert failed (likely missing columns):', insertError.message);
    } else {
        console.log('Insert succeeded (columns exist).');
        // Clean up
        await supabase.from('settings').delete().eq('user_id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

checkSettingsTable();
