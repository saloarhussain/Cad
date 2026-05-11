'use server';

import { createAdminClient } from '@/lib/supabaseServer';

/**
 * Force confirms a user's email if they are an invited designer.
 * This helps resolve "Invalid login credentials" errors caused by unconfirmed accounts.
 */
export async function forceConfirmUser(email: string) {
  try {
    const adminSupabase = await createAdminClient();
    
    // Scan for user across pages (1000 per page is max)
    let targetId = null;
    let page = 1;
    while (true) {
      const { data: { users }, error } = await adminSupabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !users || users.length === 0) break;
      
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        targetId = user.id;
        break;
      }
      page++;
    }
    
    if (targetId) {
      const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(targetId, {
        email_confirm: true
      });
      if (updateErr) throw updateErr;
      console.log(`[forceConfirmUser] Successfully unblocked/confirmed ${email}`);
      return { success: true };
    }
    
    return { success: false, error: 'User not found in Auth system' };
  } catch (err: any) {
    console.error('[forceConfirmUser] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Generates a one-time magic link for an invited user.
 */
export async function getOneClickLoginLink(email: string) {
  try {
    const adminSupabase = await createAdminClient();
    const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    });
    
    if (linkErr) throw linkErr;
    
    return { 
      success: true, 
      link: linkData.properties.action_link + `&redirect_to=${encodeURIComponent('https://www.cadonce.com/')}`
    };
  } catch (err: any) {
    console.error('[getOneClickLoginLink] Error:', err.message);
    return { success: false, error: err.message };
  }
}
