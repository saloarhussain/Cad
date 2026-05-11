import { createAdminClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const adminSupabase = await createAdminClient();
    const { data, error } = await adminSupabase.from('settings').select('*');
    
    if (error) throw error;
    
    return NextResponse.json({ 
      count: data.length,
      rows: data.map(r => ({ 
        id: r.id, 
        user_id: r.user_id, 
        gmailUser: r.gmailUser,
        has_payment_methods: !!r.payment_methods
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
