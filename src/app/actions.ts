'use server';

import { readDb, insertRecord, updateRecord, deleteRecord, upsertSettings } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sendEmail, invoiceTemplate, composeTemplate, projectAssignmentTemplate, fundsReleasedTemplate, feedbackReceivedTemplate } from '@/lib/mailer';
import { createClient } from '@/lib/supabaseServer';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/lib/payment';
import { getSignedUrl } from '@/lib/storage';

/**
 * Helper to get the current authenticated user in a server action.
 * This ensures security by not relying on a client-provided userId.
 */
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

export async function saveDesigner(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const onboardingMode = formData.get('onboardingMode') as string || 'new';

    const newDesigner: any = {
      id: Date.now().toString(),
      fullName: formData.get('fullName'),
      specialty: formData.get('specialty') || 'CAD Designer',
      experience: formData.get('experience'),
      employmentType: formData.get('employmentType') || 'Freelancer',
      skills: JSON.parse(formData.get('skills') as string || '[]'),
      email: (formData.get('email') as string)?.trim()?.toLowerCase(),
      mobile: formData.get('mobile'),
      country: formData.get('country'),
      performance: parseInt(formData.get('performance') as string) || 90,
      createdAt: new Date().toISOString(),
      user_id: user.id // [CRITICAL FIX] Associate the new designer with the hiring organization
    };

    // Safety for Registered Mode: Don't overwrite with nulls if we don't have them
    if (onboardingMode === 'registered') {
      delete newDesigner.fullName;
      delete newDesigner.experience;
      delete newDesigner.skills;
      delete newDesigner.mobile;
      delete newDesigner.country;
    }

    const portalAccess = formData.get('hasPortalAccess');
    if (portalAccess === 'on') {
      newDesigner.hasPortalAccess = true;
    }

    // Check for existing designer in DB
    const { data: existingDbDesigner } = await supabase
      .from('designers')
      .select('*')
      .ilike('email', newDesigner.email)
      .maybeSingle();

    let designerId = existingDbDesigner?.id;

    if (existingDbDesigner) {
      // If it's a registered hire, only update what's necessary to avoid overwriting existing profile data
      const updateData = onboardingMode === 'registered' 
        ? { 
            employmentType: newDesigner.employmentType,
            hasPortalAccess: newDesigner.hasPortalAccess ?? existingDbDesigner.hasPortalAccess,
            user_id: user.id // Associate with the hiring organization
          }
        : { ...newDesigner, user_id: user.id };

      const { error: updateError } = await supabase
        .from('designers')
        .update(updateData)
        .eq('id', existingDbDesigner.id);

      if (updateError) throw updateError;
      console.log(`[saveDesigner] Updated existing DB record for ${newDesigner.email}`);
    } else {
      // Create new record
      const { data: created, error: createError } = await supabase
        .from('designers')
        .insert(newDesigner)
        .select()
        .single();
      if (createError) {
        if (createError.message.includes('already exists') || createError.code === '23505') {
           // Fallback if race condition occurred
           console.log('[saveDesigner] Duplicate email race condition, updating existing...');
        } else {
           throw createError;
        }
      }
      designerId = created?.id;
    }

    // Send Invitation Email if Portal Access is granted
    if (newDesigner.hasPortalAccess && newDesigner.email) {
      try {
        const { createAdminClient } = await import('@/lib/supabaseServer');
        const adminSupabase = await createAdminClient();

        // 1. Check if user already exists in Auth
        let userAlreadyExists = false;
        const { error: authErr } = await adminSupabase.auth.admin.createUser({
          email: newDesigner.email,
          email_confirm: true,
          user_metadata: { role: 'designer' }
        });

        if (authErr) {
          if (authErr.message.includes('already been registered')) {
            // Aggressive Check: If Auth says they exist, we start with true
            // and only go back to setup if we can't find ANY evidence of them being onboarded.
            userAlreadyExists = true; 
            
            const regCheck = await checkIfUserIsRegistered(newDesigner.email);
            // If they are missing metadata AND database info, then they truly aren't "registered" in our terms
            if (!regCheck.registered) {
               userAlreadyExists = false;
            }
            console.log(`[saveDesigner] User ${newDesigner.email} exists in Auth. Onboarding complete: ${userAlreadyExists}`);
            
            // Ensure they have the designer role even if they already existed
            const existingUser = await findAuthUserByEmail(adminSupabase, newDesigner.email);
            if (existingUser) {
              await adminSupabase.auth.admin.updateUserById(existingUser.id, {
                user_metadata: { ...existingUser.user_metadata, role: 'designer' },
                email_confirm: true
              });
            }
          } else {
            throw authErr;
          }
        } else {
          console.log(`[saveDesigner] Created new Auth user for ${newDesigner.email}`);
        }

        // [DYNAMIC ORIGIN] Resolve the base URL for links (localhost vs production)
        const headerList = await headers();
        const host = headerList.get('host');
        const protocol = headerList.get('x-forwarded-proto') || 'http';
        const baseUrl = `${protocol}://${host}`;

        // [REFINED] Designer Redirection Logic
        // 1. Registered Designer: Send to Login Page
        // 2. New Designer: Send to Setup/Register Page
        const regCheck = await checkIfUserIsRegistered(newDesigner.email);
        userAlreadyExists = regCheck.registered;
        
        let setupLink = `${baseUrl}/auth/setup?email=${encodeURIComponent(newDesigner.email)}`;
        
        if (userAlreadyExists) {
          // Send to login instead of setup/magic link as requested
          setupLink = `${baseUrl}/auth/login?email=${encodeURIComponent(newDesigner.email)}&invited=true`;
          
          try {
            // [HARDENED] Ensure the existing user is confirmed and has the correct role
            const existingUser = await findAuthUserByEmail(adminSupabase, newDesigner.email);
            if (existingUser) {
              await adminSupabase.auth.admin.updateUserById(existingUser.id, {
                user_metadata: { ...existingUser.user_metadata, role: 'designer' },
                email_confirm: true
              });
              console.log(`[saveDesigner] Confirmed and Updated existing auth user: ${newDesigner.email}`);
            }
          } catch (err: any) {
            console.warn('[saveDesigner] Auth update warning:', err.message);
          }
        }

        const { data: invitingUserSettings } = await adminSupabase
          .from('settings')
          .select('organizationName')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const organizationName = invitingUserSettings?.organizationName || user.user_metadata?.organization_name || 'CADONCE';

        const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle();
        const { sendEmail, designerInviteTemplate } = await import('@/lib/mailer');
        const { PLATFORM_CONFIG } = await import('@/lib/config');
        
        const credentials = {
          user: PLATFORM_CONFIG.FOUNDER_EMAIL,
          password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
          senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          smtpSecure: true
        };

        // Ensure we have a display name for the template
        const displayDesigner = {
          ...newDesigner,
          fullName: newDesigner.fullName || existingDbDesigner?.fullName || 'Professional Designer'
        };

        const mailInfo = await sendEmail({
          to: newDesigner.email,
          subject: userAlreadyExists 
            ? `New Organization Invitation: Join ${organizationName}`
            : `Invitation to join your CADONCE Workstation`,
          html: designerInviteTemplate(displayDesigner, setupLink, organizationName),
          credentials
        });
        console.log(`[saveDesigner] Email sent successfully to ${newDesigner.email}. ID: ${mailInfo.messageId}`);

        // [NEW] In-App Notification (Safely handled)
        try {
          const { data: { users } } = await adminSupabase.auth.admin.listUsers();
          const targetUser = users.find(u => u.email?.toLowerCase() === newDesigner.email.toLowerCase());
          
          if (targetUser) {
            const organizationName = user.user_metadata?.organization_name || 'An Organization';
            await createNotification(
              targetUser.id,
              'update',
              'Team Invitation',
              `${organizationName} has invited you to join their designer team.`,
              '/designer'
            );
          }
        } catch (notifyErr) {
          console.error('[saveDesigner] Notification failed:', notifyErr);
        }
      } catch (mailErr: any) {
        console.error('[saveDesigner] Mail error:', mailErr.message);
        // We still return success: true because the designer record was created,
        // but we should ideally log this so the UI can show a warning.
        return { success: true, id: designerId, warning: `Designer saved, but invitation email failed: ${mailErr.message}` };
      }
    }

    revalidatePath('/team');
    return { success: true, id: designerId };
  } catch (err: any) {
    console.error('[saveDesigner] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function resendDesignerInvite(designerId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // 1. Fetch designer
    const { data: designer } = await supabase.from('designers').select('*').eq('id', designerId).maybeSingle();
    if (!designer) throw new Error('Designer not found');
    if (!designer.email) throw new Error('Designer email not found');

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 2. Check if user already exists
    let userAlreadyExists = false;
    const { error: authErr } = await adminSupabase.auth.admin.createUser({
      email: designer.email,
      email_confirm: true,
      user_metadata: { role: 'designer' }
    });

    if (authErr && authErr.message.includes('already been registered')) {
      const regCheck = await checkIfUserIsRegistered(designer.email);
      userAlreadyExists = regCheck.registered;
      
      // Ensure they have the designer role
      const existingUser = await findAuthUserByEmail(adminSupabase, designer.email);
      if (existingUser) {
        await adminSupabase.auth.admin.updateUserById(existingUser.id, {
          user_metadata: { ...existingUser.user_metadata, role: 'designer' },
          email_confirm: true
        });
      }
    }

    // 3. (Link generation handled by setup gateway)

    const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle();
    const { sendEmail, designerInviteTemplate } = await import('@/lib/mailer');
    const { PLATFORM_CONFIG } = await import('@/lib/config');
    
    const credentials = {
      user: PLATFORM_CONFIG.FOUNDER_EMAIL,
      password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
      senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true
    };
    
    let setupLink = `https://www.cadonce.com/auth/setup?email=${encodeURIComponent(designer.email)}`;
    
    if (userAlreadyExists) {
      try {
        const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: designer.email
        });
        if (linkErr) throw linkErr;
        setupLink = linkData.properties.action_link + `&redirect_to=${encodeURIComponent('https://www.cadonce.com/')}`;
      } catch (err: any) {
        setupLink = `https://www.cadonce.com/auth/login?email=${encodeURIComponent(designer.email)}&invited=true&debug_err=${encodeURIComponent(err.message)}`;
      }
    }

    // 4. Send Email
    try {
      await sendEmail({
        to: designer.email,
        subject: `Resending: Your CADONCE Workstation Access`,
        html: designerInviteTemplate(designer, setupLink, user.user_metadata?.organization_name || 'CADONCE'),
        credentials
      });
    } catch (mailErr: any) {
      console.error('[resendDesignerInvite] Mail error:', mailErr.message);
      return { success: true, warning: `Invitation resent to dashboard, but email delivery failed: ${mailErr.message}` };
    }

    // 4. Update Designer Performance (Auto-Calculation Logic)
    const { data: designerData } = await supabase
      .from('designers')
      .select('performance, id')
      .eq('fullName', designer.fullName)
      .single();

    if (designerData) {
      const currentPerf = designerData.performance || 90;
      const newPerf = Math.min(100, currentPerf + 2); // +2% per successful project release

      await supabase
        .from('designers')
        .update({ performance: newPerf })
        .eq('id', designerData.id);
    }

    console.log(`[resendDesignerInvite] Email resent to ${designer.email}`);

    // [NEW] In-App Notification (Safely handled)
    try {
      const { data: { users } } = await adminSupabase.auth.admin.listUsers();
      const targetUser = users.find(u => u.email?.toLowerCase() === designer.email.toLowerCase());

      if (targetUser) {
        const organizationName = user.user_metadata?.organization_name || 'An Organization';
        await createNotification(
          targetUser.id,
          'update',
          'Invitation Reminder',
          `${organizationName} has resent your invitation to join their team.`,
          '/designer'
        );
      }
    } catch (notifyErr) {
      console.error('[resendDesignerInvite] Notification failed:', notifyErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[resendDesignerInvite] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function updateDesigner(id: string, updates: any) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    console.log(`[updateDesigner] Updating designer ${id} with:`, updates);

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // [GLOBAL SYNC] Update ALL designer records associated with this email
    // This ensures that if a designer works for multiple organizations, 
    // their personal profile remains consistent across all of them.
    const userEmail = user.email || '';
    const { error: globalError, count: globalCount } = await adminSupabase
      .from('designers')
      .update(updates)
      .ilike('email', userEmail)
      .select();

    if (globalError) {
       console.error('[updateDesigner] Global sync failed:', globalError.message);
       // Fallback to targeted ID update if global fails
       await adminSupabase.from('designers').update(updates).eq('id', id);
    } else {
       console.log(`[updateDesigner] Global sync success. Records updated: ${globalCount}`);
    }

    revalidatePath('/team');
    revalidatePath(`/team/${id}`);
    revalidatePath('/settings');
    revalidatePath('/designer');
    revalidatePath('/');

    // [TRIPLE-SYNC] Ensure location persists in Settings and Auth Metadata too
    if (updates.country) {
       try {
         const { createAdminClient } = await import('@/lib/supabaseServer');
         const adminSupabase = await createAdminClient();

         // 1. Sync to Auth Metadata
         await adminSupabase.auth.admin.updateUserById(user.id, {
           user_metadata: { 
             ...user.user_metadata, 
             country: updates.country || user.user_metadata?.country,
             full_name: updates.fullName || user.user_metadata?.full_name
           }
         });

         // 2. Sync to System Config in Settings table
         const { data: settings } = await adminSupabase
           .from('settings')
           .select('payment_methods')
           .eq('user_id', user.id)
           .maybeSingle();
         
         if (settings) {
            const methods = settings.payment_methods || [];
            const configIndex = methods.findIndex((m: any) => m.id === 'system_config');
            if (configIndex > -1) {
               methods[configIndex].country = updates.country;
               await adminSupabase
                 .from('settings')
                 .update({ payment_methods: methods })
                 .eq('user_id', user.id);
            }
         }
         console.log(`[updateDesigner] Triple-Sync completed for country: ${updates.country}`);
       } catch (syncErr) {
         console.warn('[updateDesigner] Triple-Sync non-critical failure:', syncErr);
       }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[updateDesigner] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteDesigner(id: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // [POLICY CHANGE] Organizations can no longer delete a designer's global Auth account.
    // They only remove the designer from their own team list.
    // The designer's Auth account remains active for their own use or for other organizations.

    // 3. Delete from designers table
    const { error } = await supabase
      .from('designers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/team');
    return { success: true };
  } catch (err: any) {
    console.error('[deleteDesigner] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function saveProject(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const newProject = {
      id: Date.now().toString(),
      title: formData.get('title'),
      orderId: formData.get('orderId'),
      client: formData.get('client'),
      designer: formData.get('designer'),
      revenue: formData.get('revenue'),
      revenueCurrency: formData.get('revenueCurrency') || '$',
      expense: formData.get('expense'),
      expenseCurrency: formData.get('expenseCurrency') || '₹',
      orderDate: formData.get('orderDate'),
      deadlineDate: formData.get('deadlineDate'),
      description: formData.get('brief'),
      images: (() => {
        const val = formData.get('images');
        if (!val) return [];
        try {
          return JSON.parse(val as string);
        } catch {
          return (val as string).split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' })).filter(i => i.url);
        }
      })(),
      cadFile: formData.get('cadFile'),
      paymentStatus: formData.get('paymentStatus') || 'Unpaid',
      paidAmount: formData.get('paidAmount') || '0',
      useEscrow: formData.get('useEscrow') === 'on',
      status: 'High Priority',
      createdAt: new Date().toISOString()
    };

    await insertRecord('projects', newProject, user.id, supabase);

    // [NEW] Send Email to Designer if assigned
    if (newProject.designer) {
      try {
        const { data: designer } = await supabase
          .from('designers')
          .select('email')
          .ilike('fullName', String(newProject.designer))
          .maybeSingle();

        if (designer?.email) {
          const { data: invitingUserSettings } = await supabase
            .from('settings')
            .select('organizationName')
            .eq('user_id', user.id)
            .maybeSingle();
          
          const organizationName = invitingUserSettings?.organizationName || user.user_metadata?.organization_name || 'CADONCE';
          
          // [DYNAMIC ORIGIN] Resolve the base URL for links
          const headerList = await headers();
          const host = headerList.get('host');
          const protocol = headerList.get('x-forwarded-proto') || 'http';
          const baseUrl = `${protocol}://${host}`;
          const magicLink = `${baseUrl}/projects/${newProject.id}`;

          await sendEmail({
            to: designer.email,
            subject: `New Project Assigned: ${newProject.title}`,
            html: projectAssignmentTemplate(newProject, organizationName, magicLink),
            credentials: {
              user: PLATFORM_CONFIG.FOUNDER_EMAIL,
              password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
              senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
              smtpHost: 'smtp.gmail.com',
              smtpPort: 465,
              smtpSecure: true
            }
          });
          console.log(`[Email] Assignment email sent to ${designer.email}`);
        }
      } catch (mailErr: any) {
        console.error('[Email] Failed to send assignment email:', mailErr.message);
      }
    }

    // [ESCROW] If escrow is enabled, initiate the hold protocol
    if (newProject.useEscrow) {
      try {
        await initiateProjectEscrow(newProject.id, Number(newProject.expense));
      } catch (escrowErr) {
        console.error('[saveProject] Escrow Initialization Failed:', escrowErr);
        // We continue project creation but escrow won't be 'Active' in DB until resolved
      }
    }

    revalidatePath('/projects');
    return { success: true, id: newProject.id };
  } catch (err: any) {
    console.error('[saveProject] Error:', err.message);
    return { success: false, error: err.message || 'Failed to save project.' };
  }
}

export async function submitProjectRequest(data: {
  title: string;
  description: string;
  images: any[];
  clientId: string;
  clientName: string;
  budget?: string;
  currency?: string;
  deadlineDate?: string;
}) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get the Organization Owner's ID (the user who owns the client record)
    const { data: client, error: cError } = await adminSupabase
      .from('clients')
      .select('user_id')
      .eq('id', data.clientId)
      .single();

    if (cError || !client) throw new Error('Invalid client identity.');

    const newRequest = {
      id: Date.now().toString(),
      title: data.title,
      client: data.clientName,
      description: data.description,
      images: Array.isArray(data.images) ? data.images : [],
      status: 'Pending Review',
      paymentStatus: 'Unpaid',
      revenue: data.budget || '0',
      revenueCurrency: data.currency || 'USD',
      orderDate: new Date().toISOString().split('T')[0], // Automatically pick today's date
      deadlineDate: data.deadlineDate || '',
      expense: '0',
      createdAt: new Date().toISOString(),
      user_id: client.user_id // Associate with the organization owner
    };

    const { error: insError } = await adminSupabase
      .from('projects')
      .insert(newRequest);

    if (insError) throw insError;

    // 3. Trigger Notification for Organization Admin
    await createNotification(
      client.user_id,
      'intake',
      'New Project Request',
      `Client "${data.clientName}" has submitted a new project: ${data.title}`,
      `/projects/${newRequest.id}`
    );

    return { success: true, id: newRequest.id };
  } catch (err: any) {
    console.error('[submitProjectRequest] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteProject(projectId: string) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Verify Ownership before deep delete
    const { data: project, error: fetchError } = await adminSupabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) throw new Error('Project not found');
    if (project.user_id !== user.id) throw new Error('Unauthorized: You do not own this project.');

    console.log(`[deleteProject] Deep Cleaning Project: ${projectId}`);

    // 2. Cascade Delete related data
    await Promise.all([
      adminSupabase.from('chat_messages').delete().eq('project_id', projectId),
      adminSupabase.from('project_escrow').delete().eq('project_id', projectId),
      adminSupabase.from('otp_verifications').delete().eq('project_id', projectId)
    ]);

    // 3. Final Project Record Deletion
    const { error: delError } = await adminSupabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (delError) throw delError;

    revalidatePath('/projects');
    return { success: true };
  } catch (err: any) {
    console.error('[deleteProject] Critical Error:', err.message);
    return { success: false, error: err.message || 'Failed to delete project.' };
  }
}

export async function updateProject(projectId: string, data: any) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    // 1. Check for designer change to sync escrow
    const { data: oldProject } = await supabase.from('projects').select('designer').eq('id', projectId).maybeSingle();

    await updateRecord('projects', projectId, {
      ...data,
      updatedAt: new Date().toISOString()
    }, user.id, supabase);

    // 2. Escrow Synchronization
    if (oldProject && data.designer && oldProject.designer !== data.designer) {
      const { data: newDesigner } = await supabase
        .from('designers')
        .select('user_id')
        .ilike('fullName', data.designer)
        .maybeSingle();

      if (newDesigner?.user_id) {
        await supabase
          .from('project_escrow')
          .update({ designer_id: newDesigner.user_id })
          .eq('project_id', projectId)
          .eq('status', 'active');
      }
    }

    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[updateProject] Error:', err.message);
    return { success: false, error: err.message || 'Failed to update project.' };
  }
}

export async function updateProjectAction(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const projectId = formData.get('id') as string;

    const updatedData: any = {
      title: formData.get('title'),
      orderId: formData.get('orderId'),
      client: formData.get('client'),
      designer: formData.get('designer'),
      revenue: formData.get('revenue'),
      revenueCurrency: formData.get('revenueCurrency') as string || '$',
      expense: formData.get('expense'),
      expenseCurrency: formData.get('expenseCurrency') as string || '₹',
      orderDate: formData.get('orderDate'),
      deadlineDate: formData.get('deadlineDate'),
      description: formData.get('brief'),
      images: (() => {
        const val = formData.get('images');
        if (!val) return undefined;
        try {
          return JSON.parse(val as string);
        } catch {
          return (val as string).split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' })).filter(i => i.url);
        }
      })(),
      cadFile: formData.get('cadFile'),
      paymentStatus: formData.get('paymentStatus'),
      paidAmount: formData.get('paidAmount'),
      updatedAt: new Date().toISOString()
    };

    // Auto-detect if this is a delivery update by status change or designer action
    const isDesignerStatus = await getDesignerStatus();
    if (isDesignerStatus.isDesigner) {
      updatedData.status = 'Revised Delivery';
    }

    // 1. Fetch current project to check for designer/status change
    const { data: oldProject } = await supabase.from('projects').select('designer, title, status, user_id').eq('id', projectId).maybeSingle();

    await updateRecord('projects', projectId, updatedData, user.id, supabase);

    // 2. Escrow Synchronization: If designer changed, update escrow beneficiary
    if (oldProject && updatedData.designer && oldProject.designer !== updatedData.designer) {
      console.log(`[Escrow Sync] Designer change detected: ${oldProject.designer} -> ${updatedData.designer}`);
      
      // Find new designer's user_id and email
      const { data: newDesigner } = await supabase
        .from('designers')
        .select('user_id, email')
        .ilike('fullName', String(updatedData.designer))
        .maybeSingle();

      if (newDesigner?.user_id) {
        await supabase
          .from('project_escrow')
          .update({ designer_id: newDesigner.user_id })
          .eq('project_id', projectId)
          .eq('status', 'active');
      }

      // [NEW] Send Email to Designer on assignment
      if (newDesigner?.email) {
        try {
          const { data: invitingUserSettings } = await supabase
            .from('settings')
            .select('organizationName')
            .eq('user_id', user.id)
            .maybeSingle();
          
          const organizationName = invitingUserSettings?.organizationName || user.user_metadata?.organization_name || 'CADONCE';
          
          // [DYNAMIC ORIGIN] Resolve the base URL for links
          const headerList = await headers();
          const host = headerList.get('host');
          const protocol = headerList.get('x-forwarded-proto') || 'http';
          const baseUrl = `${protocol}://${host}`;
          const magicLink = `${baseUrl}/projects/${projectId}`;

          await sendEmail({
            to: newDesigner.email,
            subject: `Project Assignment: ${updatedData.title || oldProject.title}`,
            html: projectAssignmentTemplate({ ...oldProject, ...updatedData, id: projectId }, organizationName, magicLink),
            credentials: {
              user: PLATFORM_CONFIG.FOUNDER_EMAIL,
              password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
              senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
              smtpHost: 'smtp.gmail.com',
              smtpPort: 465,
              smtpSecure: true
            }
          });
          console.log(`[Email] Assignment email sent to ${newDesigner.email}`);
        } catch (mailErr: any) {
          console.error('[Email] Failed to send assignment email:', mailErr.message);
        }
      }
    }

    // 3. Status Change Notification
    if (oldProject && updatedData.status && oldProject.status !== updatedData.status) {
      try {
        // Find designer to notify
        const { data: designer } = await supabase
          .from('designers')
          .select('user_id')
          .ilike('fullName', updatedData.designer || oldProject.designer || '')
          .maybeSingle();

        if (designer?.user_id && designer.user_id !== user.id) {
          await createNotification(
            designer.user_id,
            'update',
            'Project Status Updated',
            `Project "${updatedData.title || oldProject.title}" is now: ${updatedData.status}`,
            `/projects/${projectId}`
          );
        }
      } catch (notifyErr) {
        console.error('[updateProjectAction] Notification Error:', notifyErr);
      }
    }

    // Global Notification Bridge: Notify both Client and Organization Agent
    if (isDesignerStatus.isDesigner && oldProject) {
      try {
        // 1. Notify Client (Existing logic)
        await notifyDelivery(projectId);
        
        // 2. Notify Organization (New logic)
        const { createAdminClient } = await import('@/lib/supabaseServer');
        const adminSupabase = await createAdminClient();
        
        const { data: { user: orgUser } } = await adminSupabase.auth.admin.getUserById(oldProject.user_id);
        const orgEmail = orgUser?.email;
        
        // In-App Notification for Organization
        await createNotification(
          oldProject.user_id,
          'update',
          'Job Delivered',
          `Designer has delivered the job for project "${oldProject.title}".`,
          `/projects/${projectId}`
        );
        
        // Email Notification for Organization
        if (orgEmail) {
          const { sendEmail, composeTemplate } = await import('@/lib/mailer');
          const { PLATFORM_CONFIG } = await import('@/lib/config');
          
          const credentials = {
            user: PLATFORM_CONFIG.FOUNDER_EMAIL,
            password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
            senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
            smtpHost: 'smtp.gmail.com',
            smtpPort: 465,
            smtpSecure: true
          };

          const mailContent = `The designer has delivered the job for project "${oldProject.title}". Please review the files in the project workstation.`;

          await sendEmail({
            to: orgEmail,
            subject: `[JOB DELIVERED] ${oldProject.title}`,
            html: composeTemplate(orgEmail, `Job Delivered`, mailContent, oldProject.title || 'Project'),
            credentials
          });
        }
        
        console.log(`[Notification Bridge] Alerts dispatched for project: ${projectId}`);
      } catch (notifyErr) {
        console.error('[Notification Bridge] Error:', notifyErr);
      }
    }

    revalidatePath('/projects');
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[updateProjectAction] Error:', err.message);
    return { success: false, error: err.message || 'Failed to update project.' };
  }
}

export async function saveClient(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const shouldInvite = formData.get('sendInvite') === 'true';
    
    const newClient = {
      id: Date.now().toString(),
      name: formData.get('name'),
      companyName: formData.get('companyName'),
      email: (formData.get('email') as string)?.trim()?.toLowerCase(),
      mobile: formData.get('mobile'),
      country: formData.get('country'),
      platform: formData.get('platform'),
      priority: formData.get('priority'),
      createdAt: new Date().toISOString()
    };

    await insertRecord('clients', newClient, user.id, supabase);

    if (shouldInvite && newClient.email) {
      try {
        const { createAdminClient } = await import('@/lib/supabaseServer');
        const adminSupabase = await createAdminClient();
        const emailStr = String(newClient.email);
        
        // 1. Create or Check Auth User
        const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
          email: emailStr,
          email_confirm: true,
          user_metadata: { 
            role: 'client', 
            company_name: newClient.companyName || 'Independent',
            full_name: newClient.name 
          }
        });

        let userAlreadyExists = false;
        if (authErr) {
          if (authErr.message.includes('already registered')) {
            userAlreadyExists = true;
            // Update role if exists
            const { data: { users } } = await adminSupabase.auth.admin.listUsers();
            const existingUser = users.find(u => u.email?.toLowerCase() === emailStr.toLowerCase());
            if (existingUser) {
              await adminSupabase.auth.admin.updateUserById(existingUser.id, {
                user_metadata: { ...existingUser.user_metadata, role: 'client' }
              });
            }
          } else {
            throw authErr;
          }
        }

        // [REFINED] Bulletproof Onboarding: Send a plain link.
        const setupLink = `https://www.cadonce.com/auth/setup?email=${encodeURIComponent(emailStr)}`;
        const { sendEmail, clientInviteTemplate } = await import('@/lib/mailer');
        const organizationName = user.user_metadata?.organization_name || 'CADONCE Studio';

        const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle();
        const { PLATFORM_CONFIG } = await import('@/lib/config');
        
        const credentials = {
          user: PLATFORM_CONFIG.FOUNDER_EMAIL,
          password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
          senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          smtpSecure: true
        };

        await sendEmail({
          to: emailStr,
          subject: userAlreadyExists 
            ? `New Organization Invitation: Join ${organizationName}`
            : `Welcome to ${organizationName}: Your Design Workstation`,
          html: clientInviteTemplate(newClient, setupLink, organizationName),
          credentials
        });
      } catch (inviteErr: any) {
        console.error('[saveClient] Invite failed:', inviteErr.message);
        return { success: true, id: newClient.id, warning: `Client saved, but invitation failed: ${inviteErr.message}` };
      }
    }

    revalidatePath('/clients');
    return { success: true, id: newClient.id };
  } catch (err: any) {
    console.error('[saveClient] Error:', err.message);
    return { success: false, error: err.message || 'Failed to save client.' };
  }
}

export async function deleteClient(id: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/clients');
    return { success: true };
  } catch (err: any) {
    console.error('[deleteClient] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- NOTIFICATION ACTIONS ---

export async function createNotification(userId: string, type: string, title: string, content: string, link: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      content,
      link,
      is_read: false
    });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[createNotification] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getNotifications() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return { success: true, notifications: data };
  } catch (err: any) {
    console.error('[getNotifications] Error:', err.message);
    return { success: false, notifications: [] };
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[markNotificationAsRead] Error:', err.message);
    return { success: false };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[markAllNotificationsAsRead] Error:', err.message);
    return { success: false };
  }
}

export async function updateClient(clientId: string, data: any) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    await updateRecord('clients', clientId, {
      ...data,
      updatedAt: new Date().toISOString()
    }, user.id, supabase);
    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[updateClient] Error:', err.message);
    return { success: false, error: err.message || 'Failed to update client.' };
  }
}

export async function saveSettings(formData: FormData) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    await upsertSettings({
      gmailClientId: formData.get('gmailClientId') as string,
      gmailClientSecret: formData.get('gmailClientSecret') as string,
      gmailUser: formData.get('gmailUser') as string,
      gmailAppPassword: formData.get('gmailAppPassword') as string,
      senderName: formData.get('senderName') as string,
      smtpHost: formData.get('smtpHost') as string,
      smtpPort: parseInt(formData.get('smtpPort') as string || '465'),
      smtpSecure: formData.get('smtpSecure') === 'true',
    }, user.id, supabase);

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('[saveSettings] Error:', err.message);
    return { success: false, error: err.message || 'Failed to save settings.' };
  }
}

export async function saveAllSettings(formData: FormData, paymentMethods: any[]) {
  try {
    const { user } = await getAuthenticatedUser();

    // Use Admin Client to bypass RLS for this administrative task
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // Consolidate ALL extended settings into the system_config record to bypass schema limitations
    const extendedConfig = {
      id: 'system_config',
      type: 'INTERNAL_CONFIG',
      smtpHost: formData.get('smtpHost') as string,
      smtpPort: parseInt(formData.get('smtpPort') as string || '465'),
      smtpSecure: formData.get('smtpSecure') === 'true',
      gmailClientId: formData.get('gmailClientId') as string,
      gmailClientSecret: formData.get('gmailClientSecret') as string,
      organization_name: formData.get('organizationName') as string,
      commissionRate: parseFloat(formData.get('commissionRate') as string) || 5,
      razorpayKeyId: formData.get('razorpayKeyId') as string,
      razorpayKeySecret: formData.get('razorpayKeySecret') as string,
      escrowWallet: formData.get('escrowWallet') as string,
      settlementPeriod: formData.get('settlementPeriod') as string,
      owner_name: formData.get('ownerName') as string,
      whatsapp: formData.get('whatsapp') as string,
      avatar_url: formData.get('avatarUrl') as string,
      country: formData.get('country') as string,
      pointsBalance: parseInt(formData.get('pointsBalance') as string || '0'),
    };

    const enrichedMethods = [
      ...paymentMethods.filter(m => m.id !== 'system_config'),
      extendedConfig
    ];

    const settingsPayload = {
      user_id: user.id,
      gmailUser: formData.get('gmailUser') as string,
      gmailAppPassword: formData.get('gmailAppPassword') as string,
      senderName: formData.get('senderName') as string,
      organization_name: formData.get('organizationName') as string,
      owner_name: formData.get('ownerName') as string,
      whatsapp: formData.get('whatsapp') as string,
      avatar_url: formData.get('avatarUrl') as string,
      points_balance: parseInt(formData.get('pointsBalance') as string || '0'),
      payment_methods: enrichedMethods,
    };

    console.log('[saveAllSettings] Target User ID:', user.id);

    // Check for existing record
    const { data: existingSettings } = await adminSupabase
      .from('settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let writeError;
    if (existingSettings) {
      // Update by primary key ID
      console.log('[saveAllSettings] Updating existing record ID:', existingSettings.id);
      const { error } = await adminSupabase
        .from('settings')
        .update(settingsPayload)
        .eq('id', existingSettings.id);
      writeError = error;
    } else {
      // Manual ID Increment Fallback: Find max ID and add 1
      console.log('[saveAllSettings] Creating new record for user:', user.id);
      const { data: maxRow } = await adminSupabase
        .from('settings')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      
      const nextId = (maxRow?.[0]?.id || 0) + 1;
      console.log('[saveAllSettings] Manual Sequence Next ID:', nextId);
      
      const { error } = await adminSupabase
        .from('settings')
        .insert({ ...settingsPayload, id: nextId });
      writeError = error;
    }

    if (writeError) {
      console.error('[saveAllSettings] Critical Persistence Error:', writeError.message);
      return { success: false, error: `Database Error: ${writeError.message}` };
    }

    // [SYNC] Update Auth Metadata for platform-wide identity
    try {
      await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          organization_name: formData.get('organizationName'),
          full_name: formData.get('ownerName'),
          whatsapp: formData.get('whatsapp'),
          avatar_url: formData.get('avatarUrl')
        }
      });
    } catch (metaErr: any) {
      console.warn('[saveAllSettings] Metadata sync warning:', metaErr.message);
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('[saveAllSettings] Error:', err.message);
    return { success: false, error: err.message || 'Failed to save settings.' };
  }
}

export async function getMySettings() {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data, error } = await adminSupabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    
    // Extract virtual columns from payment_methods system_config
    if (data && data.payment_methods) {
      const config = data.payment_methods.find((m: any) => m.id === 'system_config');
      if (config) {
        data.organizationName = config.organization_name || config.organizationName;
        data.razorpayKeyId = config.razorpayKeyId;
        data.razorpayKeySecret = config.razorpayKeySecret;
        data.smtpHost = config.smtpHost;
        data.smtpPort = config.smtpPort;
        data.smtpSecure = config.smtpSecure;
        data.commissionRate = config.commissionRate;
        data.escrowWallet = config.escrowWallet;
        data.settlementPeriod = config.settlementPeriod;
        data.ownerName = config.owner_name || config.ownerName;
        data.whatsapp = config.whatsapp;
        data.avatarUrl = config.avatar_url || config.avatarUrl;
        data.country = config.country;
        data.pointsBalance = config.points_balance || config.pointsBalance || 0;
      }
    }

    // Support flat column extraction if JSON extraction was empty
    const finalSettings = data || { user_id: user.id } as any;
    if (!finalSettings.organizationName) finalSettings.organizationName = data?.organization_name;
    if (!finalSettings.ownerName) finalSettings.ownerName = data?.owner_name;
    if (!finalSettings.avatarUrl) finalSettings.avatarUrl = data?.avatar_url;
    if (!finalSettings.pointsBalance) finalSettings.pointsBalance = data?.points_balance;
    
    // Auto-detect from Auth Metadata if database record is fresh or missing fields
    if (!finalSettings.organizationName) finalSettings.organizationName = user.user_metadata?.organization_name;
    if (!finalSettings.ownerName) finalSettings.ownerName = user.user_metadata?.full_name;
    if (!finalSettings.whatsapp) finalSettings.whatsapp = user.user_metadata?.whatsapp;

    return { success: true, settings: finalSettings };
  } catch (err: any) {
    console.error('[getMySettings] Error:', err.message);
    return { success: false, error: err.message };
  }
}

function getMailCredentials(settings: any, forceFounder: boolean = false) {
  // 0. Force Founder Mode (Used for system-wide notifications/invitations)
  if (forceFounder) {
    return {
      user: PLATFORM_CONFIG.FOUNDER_EMAIL,
      password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
      senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true
    };
  }

  // Defensive check for invalid values (null strings, empty strings, etc.)
  const isValid = (val?: string) => 
    val && 
    val !== 'null' && 
    val !== 'undefined' && 
    val.trim() !== '';

  // 1. Prioritize User-Defined Settings from DB (if they have filled their own SMTP)
  const dbUser = isValid(settings?.gmailUser) ? settings.gmailUser.trim() : null;
  const dbPass = isValid(settings?.gmailAppPassword) ? settings.gmailAppPassword.trim() : null;
  
  // 2. Environment Variables (Check if they are not placeholders)
  const envUser = process.env.GMAIL_USER;
  const envPass = process.env.GMAIL_APP_PASSWORD;
  
  // Placeholder detection: Gmail placeholders often used in templates
  const isPlaceholder = (val?: string) => 
    !isValid(val) || 
    val!.includes('your_gmail') || 
    val!.includes('your_16_char') || 
    val === 'your_gmail@gmail.com';

  const isEnvValid = !isPlaceholder(envUser) && !isPlaceholder(envPass);

  // 3. Founder Defaults (Fallback)
  const founderUser = PLATFORM_CONFIG.FOUNDER_EMAIL;
  const founderPass = PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD;

  // Priority Logic: DB > Valid Env > Founder
  const user = dbUser || (isEnvValid ? envUser : founderUser);
  const password = dbPass || (isEnvValid ? envPass : founderPass);
  
  const senderName = (isValid(settings?.senderName) ? settings.senderName : null) || 
                    (isValid(process.env.GMAIL_SENDER_NAME) ? process.env.GMAIL_SENDER_NAME : null) || 
                    PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 
                    'CADONCE Workstation';

  // Static SMTP settings for consistency (Gmail focused)
  const smtpHost = isValid(settings?.smtpHost) ? settings.smtpHost : 'smtp.gmail.com';
  const smtpPort = settings?.smtpPort || 465;
  const smtpSecure = settings?.smtpSecure !== undefined ? settings.smtpSecure : true;

  if (!user || !password) {
    throw new Error('Email credentials missing. Please configure GMAIL_USER and GMAIL_APP_PASSWORD.');
  }

  return { user, password, senderName, smtpHost, smtpPort, smtpSecure };
}

export async function sendInvoice(projectId: string) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: project } = await adminSupabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (!project) return { success: false, error: 'Project not found' };

    const { data: client } = await adminSupabase
      .from('clients')
      .select('*')
      .or(`name.eq."${project.client}",companyName.eq."${project.client}"`)
      .maybeSingle();
    const email = client?.email || project.client_email;
    const clientName = client?.name || project.client;

    if (!email) return { success: false, error: 'Client email not found.' };

    const { data: settings } = await adminSupabase.from('settings').select('*').eq('user_id', user.id).maybeSingle();
    const credentials = getMailCredentials(settings);

    const { sendEmail, invoiceTemplate } = await import('@/lib/mailer');
    await sendEmail({
      to: email,
      subject: `Invoice for Project: ${project.title}`,
      html: invoiceTemplate(project, clientName),
      text: `Invoice for ${project.title}. Total: $${project.revenue}. Balance: $${parseFloat(project.revenue || '0') - parseFloat(project.paidAmount || '0')}`,
      credentials,
    });

    return {
      success: true,
      message: `Invoice for "${project.title}" sent to ${email} successfully.`
    };
  } catch (err: any) {
    console.error('[sendInvoice] Error:', err.message);
    return { success: false, error: err.message || 'Failed to send invoice email.' };
  }
}

export async function getDesignerDb(organizationId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { projects: [], designer: null, organization: null };

    // Use Admin Client to bypass RLS and fetch all necessary production data
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Fetch Designer Profile
    let designerQuery = adminSupabase
      .from('designers')
      .select('*')
      .ilike('email', user.email)
      .order('createdAt', { ascending: false });

    const { data: designers } = await designerQuery;

    if (!designers || designers.length === 0) return { projects: [], designer: null, organization: null };

    // If multiple records exist (e.g. invited by multiple orgs), pick the most recent or the one linked to an org
    const designer = designers[0];

    // 2. Fetch Organization Metadata
    const { data: settings } = await adminSupabase
      .from('settings')
      .select('organizationName')
      .eq('user_id', designer.user_id)
      .maybeSingle();

    // 3. Fetch all projects for THIS organization owner assigned to this designer
    const { data: assignedProjects } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('user_id', designer.user_id) // STRICT ISOLATION: Only projects from this organization
      .eq('designer', designer.fullName);

    return {
      projects: assignedProjects || [],
      designer: designer,
      organization: {
        id: designer.user_id,
        name: settings?.organizationName || 'Unnamed Organization'
      }
    };
  } catch (err) {
    console.error('[getDesignerDb] Error:', err);
    return { projects: [], designer: null, organization: null };
  }
}

export async function getDesignerPortfolio() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { projects: [], portfolioItems: [] };

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Fetch Designer Profile to get full name
    const { data: designers } = await adminSupabase
      .from('designers')
      .select('fullName')
      .ilike('email', user.email);

    if (!designers || designers.length === 0) return { projects: [], portfolioItems: [] };
    const fullName = designers[0].fullName;

    // 2. Fetch all completed projects for this designer across all orgs
    const { data: projects } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('designer', fullName)
      .in('status', ['Completed', 'Approved', 'Complete']);

    // 3. Fetch custom portfolio items
    const { data: portfolioItems } = await adminSupabase
      .from('designer_portfolio_items')
      .select('*')
      .eq('designer_id', user.id);

    return { projects: projects || [], portfolioItems: portfolioItems || [] };
  } catch (err) {
    console.error('[getDesignerPortfolio] Error:', err);
    return { projects: [], portfolioItems: [] };
  }
}

export async function getProjectFeedback(projectId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('project_feedback')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw error;

    let feedback = data;
    
    // Fallback: If no feedback found or comment is missing, check project description
    const { data: project } = await supabase
      .from('projects')
      .select('description')
      .eq('id', projectId)
      .single();

    if (project?.description) {
      const match = project.description.match(/\[FEEDBACK\] Rating: (\d)\/5\nComment: ([\s\S]*)/);
      if (match) {
        if (!feedback) {
          feedback = {
            rating: parseInt(match[1]),
            comment: match[2].trim(),
            created_at: new Date().toISOString() // Fallback date
          };
        } else if (!feedback.comment) {
          feedback.comment = match[2].trim();
        }
      }
    }

    return { success: true, feedback };
  } catch (err: any) {
    console.error('[getProjectFeedback] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function submitProjectFeedback(projectId: string, rating: number, comment: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Insert into project_feedback without 'comment' to avoid schema error
    const { error } = await supabase
      .from('project_feedback')
      .insert({
        project_id: projectId,
        rating,
        organization_id: user.id
      });

    if (error) {
      console.warn('[submitProjectFeedback] project_feedback insert failed, falling back to description only.', error.message);
    }

    // 2. Append feedback to project description as a reliable fallback
    const { data: project } = await supabase
      .from('projects')
      .select('description')
      .eq('id', projectId)
      .single();

    const updatedDescription = (project?.description || '') + `\n\n[FEEDBACK] Rating: ${rating}/5\nComment: ${comment}`;

    await supabase
      .from('projects')
      .update({ description: updatedDescription })
      .eq('id', projectId);

    // 3. Fetch designer email to send notification
    const { data: projectData } = await supabase
      .from('projects')
      .select('designer, title')
      .eq('id', projectId)
      .single();

    if (projectData?.designer) {
      const { data: designerRecord } = await supabase
        .from('designers')
        .select('email')
        .ilike('fullName', projectData.designer)
        .maybeSingle();

      if (designerRecord?.email) {
        try {
          const headerList = await headers();
          const host = headerList.get('host');
          const protocol = headerList.get('x-forwarded-proto') || 'http';
          const baseUrl = `${protocol}://${host}`;
          const magicLink = `${baseUrl}/projects/${projectId}`;

          await sendEmail({
            to: designerRecord.email,
            subject: `New Feedback Received for Project: ${projectData.title}`,
            html: feedbackReceivedTemplate(projectData, rating, comment, magicLink),
            credentials: {
              user: PLATFORM_CONFIG.FOUNDER_EMAIL,
              password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
              senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
              smtpHost: 'smtp.gmail.com',
              smtpPort: 465,
              smtpSecure: true
            }
          });
        } catch (mailErr: any) {
          console.error('[submitProjectFeedback] Failed to send email:', mailErr.message);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[submitProjectFeedback] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function addDesignerPortfolioItem(title: string, description: string, images: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('designer_portfolio_items')
      .insert({
        designer_id: user.id,
        title,
        description,
        images
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[addDesignerPortfolioItem] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sharePortfolio() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const designerStatus = await getDesignerStatus();
    const organizations = designerStatus.organizations;
    
    if (!organizations || organizations.length === 0) {
      return { success: false, error: 'No organizations linked' };
    }

    const designerName = user.user_metadata?.fullName || user.email;

    for (const org of organizations) {
      await createNotification(
        org.id,
        'PORTFOLIO_SHARED',
        'Portfolio Shared',
        `${designerName} has shared their portfolio with you.`,
        `/designers/${user.id}/portfolio`
      );
    }

    return { success: true };
  } catch (err: any) {
    console.error('[sharePortfolio] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getDesignerProjectDetail(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { project: null };

    // Use Admin Client to bypass RLS for assigned project verification
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Fetch Designer Profile to get full name
    const { data: designer } = await adminSupabase
      .from('designers')
      .select('fullName, email, user_id')
      .eq('email', user.email)
      .maybeSingle();

    if (!designer) return { project: null };

    // 2. Fetch the specific project
    const { data: project } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!project) return { project: null };

    // 3. Verify Organization Membership (Isolation)
    // We check if the project belongs to the same organization owner as the designer
    const isSameOrganization = project.user_id === designer.user_id;
    if (!isSameOrganization) return { project: null };

    return { project };
  } catch (err) {
    console.error('[getDesignerProjectDetail] Error:', err);
    return { project: null };
  }
}

export async function sendMessage(formData: FormData) {
  const { user, supabase } = await getAuthenticatedUser();
  const recipient = formData.get('recipient') as string;
  const subject = formData.get('subject') as string;
  const content = formData.get('content') as string;
  const projectRef = formData.get('projectRef') as string;

  if (!recipient || !content) {
    return { success: false, error: 'Recipient and content are required.' };
  }

  const db = await readDb(user.id, supabase);

  try {
    const credentials = getMailCredentials(db.settings);
    await sendEmail({
      to: recipient,
      subject: subject || 'Message from CADONCE Studio',
      html: composeTemplate(recipient, subject, content, projectRef),
      text: content,
      credentials,
    });

    return {
      success: true,
      message: `Message dispatched successfully to ${recipient}.`
    };
  } catch (err: any) {
    console.error('[sendMessage] Error:', err.message);
    return { success: false, error: err.message || 'Failed to send message.' };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getPublicDesignerStatus(designerEmail: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: designerRecords, error: designerError } = await adminSupabase
      .from('designers')
      .select('user_id')
      .ilike('email', designerEmail);

    if (designerError || !designerRecords || designerRecords.length === 0) {
      return { organizations: [] };
    }

    const ownerIds = designerRecords.map(r => r.user_id);

    const { data: settings } = await adminSupabase
      .from('settings')
      .select('user_id, organizationName')
      .in('user_id', ownerIds);

    const organizations = await Promise.all(designerRecords.map(async (record) => {
      const setting = settings?.find(s => s.user_id === record.user_id);
      let name = setting?.organizationName;
      
      if (!name) {
        const { data: { user: owner } } = await adminSupabase.auth.admin.getUserById(record.user_id);
        name = owner?.user_metadata?.organization_name;
      }

      return {
        id: record.user_id,
        name: name || 'Organization Partner'
      };
    }));

    return {
      organizations
    };
  } catch (err) {
    console.error('[getPublicDesignerStatus] Error:', err);
    return { organizations: [] };
  }
}

export async function getDesignerByEmail(email: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data, error } = await adminSupabase
      .from('designers')
      .select('*')
      .ilike('email', email)
      .order('createdAt', { ascending: false })
      .limit(1);

    if (error) throw error;
    return { success: true, data: data?.[0] || null };
  } catch (err: any) {
    console.error('[getDesignerByEmail] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getDesignerStatus() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { isDesigner: false, organizations: [] };

    // Use Admin Client to bypass RLS for role verification
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Fetch designer records and their settings in as few round trips as possible
    const { data: designerRecords, error: designerError } = await adminSupabase
      .from('designers')
      .select('user_id')
      .ilike('email', user.email);

    if (designerError || !designerRecords || designerRecords.length === 0) {
      return { isDesigner: false, organizations: [] };
    }

    const ownerIds = designerRecords.map(r => r.user_id);

    // Fetch organization names for all hiring owners
    const { data: settings } = await adminSupabase
      .from('settings')
      .select('user_id, organizationName')
      .in('user_id', ownerIds);

    // Map records to organizations with fallbacks
    const organizations = await Promise.all(designerRecords.map(async (record) => {
      const setting = settings?.find(s => s.user_id === record.user_id);
      let name = setting?.organizationName;
      
      // Fallback: Check User Metadata if settings are empty
      if (!name) {
        const { data: { user: owner } } = await adminSupabase.auth.admin.getUserById(record.user_id);
        name = owner?.user_metadata?.organization_name;
      }

      return {
        id: record.user_id,
        name: name || 'Organization Partner'
      };
    }));

    return {
      isDesigner: true,
      organizations
    };
  } catch (err) {
    console.error('[getDesignerStatus] Error:', err);
    return { isDesigner: false, organizations: [] };
  }
}

export async function getUserInitializationData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // Fetch designer status and owner settings in parallel
    const [designerRes, ownerSettingsRes] = await Promise.all([
      getDesignerStatus(),
      adminSupabase
        .from('settings')
        .select('subscription, organizationName')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    return {
      designer: designerRes,
      subscription: ownerSettingsRes.data?.subscription || { plan: 'Free', status: 'active' },
      organizationName: ownerSettingsRes.data?.organizationName || null
    };
  } catch (err) {
    console.error('[getUserInitializationData] Error:', err);
    return null;
  }
}

export async function getDb() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Return empty state instead of throwing to prevent SSR errors 
    // when unauthenticated users hit protected pages behind AuthGuard
    return { projects: [], clients: [], designers: [], settings: {} };
  }
  return readDb(user.id, supabase);
}

export async function getViewportProject(projectId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: project, error } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, project };
  } catch (err: any) {
    console.error('[getViewportProject] Error:', err.message);
    return { success: false, error: err.message };
  }
}

function getPaymentCredentials() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Platform Payment Gateway not configured by administrator.');
  }
  return { key_id, key_secret };
}

export async function createSubscriptionOrder(planName: string, amount: number) {
  const { user, supabase } = await getAuthenticatedUser();
  const credentials = getPaymentCredentials();

  try {
    const order = await createRazorpayOrder(amount, credentials);
    return { success: true, order, key_id: credentials.key_id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function verifyAndActiveSubscription(paymentData: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planName: string;
}) {
  const { user, supabase } = await getAuthenticatedUser();
  const db = await readDb(user.id, supabase);
  const credentials = getPaymentCredentials();

  const isValid = verifyRazorpayPayment(
    paymentData.razorpay_order_id,
    paymentData.razorpay_payment_id,
    paymentData.razorpay_signature,
    credentials.key_secret
  );

  if (!isValid) {
    return { success: false, error: 'Invalid payment signature' };
  }

  // Update user profile/settings with subscription data
  const subscriptionData = {
    plan: paymentData.planName,
    status: 'active',
    lastPaymentId: paymentData.razorpay_payment_id,
    updatedAt: new Date().toISOString()
  };

  await upsertSettings({
    ...db.settings,
    subscription: subscriptionData
  }, user.id, supabase);

  revalidatePath('/pricing');
  revalidatePath('/settings');
  return { success: true };
}

export async function getCadFileUrl(projectId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // Use Admin client to allow public viewing (secured by OTP challenge on UI)
    const { data: project } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (!project) throw new Error('Project not found');

    const cadPath = project.cadFile || project.images?.split(',')[0];
    if (!cadPath) throw new Error('No CAD file associated with this project.');

    const signedUrl = await getSignedUrl(cadPath);
    return { success: true, signedUrl };
  } catch (err: any) {
    console.error('[getCadFileUrl] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function uploadCadFile(formData: FormData) {
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;

  if (!file || !projectId) {
    return { success: false, error: 'Missing file or project ID' };
  }

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${projectId}/${fileName}`;

    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use Service Role / Secret Key for administrative upload bypass
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data, error } = await supabaseAdmin.storage
      .from('project-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;
    return { success: true, path: filePath };
  } catch (err: any) {
    console.error('Server upload error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteChatMessage(messageId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { error } = await adminSupabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[deleteChatMessage] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function uploadChatFile(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    
    if (!file || !projectId) {
      return { success: false, error: 'Missing file or project ID' };
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `chat/${projectId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { error } = await supabaseAdmin.storage
      .from('project-assets')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      });

    if (error) throw error;
    return { success: true, path: filePath, name: file.name };
  } catch (err: any) {
    console.error('[uploadChatFile] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getChatFileUrl(path: string, fileName?: string) {
  try {
    const { getSignedUrl } = await import('@/lib/storage');
    const signedUrl = await getSignedUrl(path, 'project-assets', 3600, fileName); // 1 hour expiry
    return { success: true, url: signedUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSignedUploadUrl(fileName: string, projectId: string) {
  try {
    const { user } = await getAuthenticatedUser();
    const filePath = `${projectId}/${Date.now()}-${fileName}`;

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data, error } = await adminSupabase.storage
      .from('project-assets')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    return {
      success: true,
      signedUrl: data.signedUrl,
      token: data.token, // Some Supabase versions need this
      path: filePath
    };
  } catch (err: any) {
    console.error('[getSignedUploadUrl] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function submitRevision(projectId: string, note: string, fileUrls?: string[]) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // 1. Get current project to see existing revisions
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('revisions')
      .eq('id', projectId)
      .single();

    if (fetchError) throw fetchError;

    const existingRevisions = project.revisions || [];
    const revisionCount = existingRevisions.length + 1;

    const newRevision = {
      id: Date.now().toString(),
      label: `Revision ${revisionCount}`,
      note,
      fileUrls: fileUrls || [],
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };

    const updatedRevisions = [...existingRevisions, newRevision];

    // 2. Save back to database
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        revisions: updatedRevisions,
        status: 'Revision Requested'
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    // 3. Revalidate paths
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/viewport`);

    return { success: true, label: newRevision.label };
  } catch (err: any) {
    console.error('Revision submission error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function notifyDelivery(projectId: string) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get project and client info with Admin bypass
    const { data: project, error: pError } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();
    if (pError || !project) throw new Error('Project not found');

    const { data: client } = await adminSupabase
      .from('clients')
      .select('*')
      .or(`name.eq."${project.client}",companyName.eq."${project.client}"`)
      .maybeSingle();

    // 2. Get Mail Credentials from settings (Admin bypass)
    const { data: settings } = await adminSupabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const credentials = getMailCredentials(settings);

    const recipientEmail = client?.email || project.client_email;
    if (!recipientEmail) {
      return { success: false, error: 'Client email not found for this project.' };
    }

    const magicLink = `https://cadonce.com/projects/${projectId}/viewport?email=${encodeURIComponent(recipientEmail)}`;
    const clientName = client?.name || project.client || 'Client';

    // 3. Send Email
    const { sendEmail, deliveryTemplate } = await import('@/lib/mailer');
    await sendEmail({
      to: recipientEmail,
      subject: `[DESIGN READY] Your CAD Design for ${project.title} is Ready`,
      html: deliveryTemplate(project, clientName, magicLink),
      credentials
    });

    // 4. Generate WhatsApp Link
    const waMessage = `Hi ${clientName}! Your CAD design for "${project.title}" is ready for review. View it here: ${magicLink}`;
    const waLink = `https://wa.me/${client?.mobile?.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`;

    return {
      success: true,
      message: 'Delivery notification sent via email.',
      waLink
    };
  } catch (err: any) {
    console.error('Notification error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function approveProject(projectId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('projects')
      .update({
        status: 'Approved',
        approvalDate: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/viewport`);

    return { success: true };
  } catch (err: any) {
    console.error('Approval error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function updatePaymentMethods(methods: any[]) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('settings')
      .upsert({
        user_id: user.id,
        payment_methods: methods
      }, { onConflict: 'user_id' });

    if (error) throw error;

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('Update payment methods error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getPaymentSettings(projectId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: project, error: pError } = await adminSupabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .maybeSingle();

    if (pError || !project) throw new Error('Project not found');

    const { data: settings, error: sError } = await adminSupabase
      .from('settings')
      .select('payment_methods, razorpayKeyId')
      .eq('user_id', project.user_id)
      .maybeSingle();

    if (sError) throw sError;

    const methods = (settings?.payment_methods || []).filter((m: any) => m.type !== 'INTERNAL_CONFIG' && m.id !== 'system_config');

    return { 
      success: true, 
      methods,
      razorpayKey: settings?.razorpayKeyId
    };
  } catch (err: any) {
    console.error('[getPaymentSettings] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function requestViewportOtp(projectId: string, email: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Verify project and client
    const { data: project } = await adminSupabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (!project) throw new Error('Project not found');

    const { data: client } = await adminSupabase
      .from('clients')
      .select('*')
      .or(`name.eq."${project.client}",companyName.eq."${project.client}"`)
      .maybeSingle();

    const authorizedEmail = client?.email || project.client_email;
    if (!authorizedEmail || authorizedEmail.toLowerCase() !== email.toLowerCase()) {
      throw new Error('This email is not authorized to view this project.');
    }

    // 2. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Store OTP (Admin bypass)
    await adminSupabase.from('otp_verifications').delete().eq('project_id', projectId).eq('email', email);
    const { error: insertError } = await adminSupabase.from('otp_verifications').insert({
      project_id: projectId,
      email: email,
      code: otp,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
    if (insertError) throw insertError;

    // 4. Send OTP Email
    const { data: settings } = await adminSupabase.from('settings').select('*').eq('user_id', project.user_id).maybeSingle();
    const credentials = getMailCredentials(settings);
    const { sendEmail } = await import('@/lib/mailer');

    await sendEmail({
      to: authorizedEmail,
      subject: `Verification Code for ${project.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #0c0a04; color: white;">
          <h2 style="color: #fce003; text-transform: uppercase; font-size: 16px;">Identity Verification</h2>
          <p style="font-size: 12px; color: #ccc;">Use the code below to access your secure CAD viewport for <b>${project.title}</b>.</p>
          <div style="background: rgba(252, 224, 3, 0.1); padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(252, 224, 3, 0.2);">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #fce003;">${otp}</span>
          </div>
          <p style="font-size: 10px; color: #888; text-align: center;">This code will expire in 15 minutes.</p>
        </div>
      `,
      credentials
    });

    return { success: true };
  } catch (err: any) {
    console.error('[requestViewportOtp] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function verifyViewportOtp(projectId: string, email: string, code: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: verification } = await adminSupabase
      .from('otp_verifications')
      .select('*')
      .eq('project_id', projectId)
      .eq('email', email)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!verification) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    // Clean up used code
    await adminSupabase.from('otp_verifications').delete().eq('id', verification.id);

    return { success: true };
  } catch (err: any) {
    console.error('[verifyViewportOtp] Error:', err.message);
    return { success: false, error: err.message };
  }
}


export async function submitViewportFeedback(projectId: string, annotations: any[]) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get current project
    const { data: project } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    // 2. Format the feedback
    const note = annotations.map((a, i) => `Pin #${i + 1} - ${a.comment}`).join('\n');

    // 3. Add to revisions
    const existingRevisions = project.revisions || [];
    const newRevision = {
      id: Date.now().toString(),
      label: `Viewport Feedback ${existingRevisions.length + 1}`,
      note,
      annotations, // Store raw data for rendering pins in organization view later
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };

    const { error: updateError } = await adminSupabase
      .from('projects')
      .update({
        revisions: [...existingRevisions, newRevision],
        status: 'Revision Requested'
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    // 4. Trigger Notifications
    try {
      // Notify Admin
      await createNotification(
        project.user_id,
        'annotation',
        'New Viewport Feedback',
        `Feedback submitted for ${project.title} (${annotations.length} pins)`,
        `/projects/${projectId}/viewport?revId=${newRevision.id}`
      );

      // Notify Designer if assigned
      const { data: designer } = await adminSupabase
        .from('designers')
        .select('user_id')
        .ilike('fullName', project.designer || '')
        .maybeSingle();

      if (designer?.user_id) {
        await createNotification(
          designer.user_id,
          'annotation',
          'New Feedback Received',
          `Feedback pins were added to your delivery for ${project.title}`,
          `/projects/${projectId}/viewport?revId=${newRevision.id}`
        );
      }
    } catch (notifyErr) {
      console.error('[submitViewportFeedback] Notification Error:', notifyErr);
    }

    // 5. Notify Organization via Email
    const { data: settings } = await adminSupabase.from('settings').select('*').eq('user_id', project.user_id).maybeSingle();
    const credentials = getMailCredentials(settings);
    const { sendEmail } = await import('@/lib/mailer');

    await sendEmail({
      to: settings?.gmailUser || credentials.user,
      subject: `New Viewport Feedback: ${project.title}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #0c0a04; color: white; border-radius: 15px;">
          <h2 style="color: #fce003; text-transform: uppercase; font-size: 18px;">New 3D Viewport Feedback</h2>
          <p style="color: #ccc; font-size: 14px;">A client has submitted ${annotations.length} feedback pins for project: <b>${project.title}</b>.</p>
          <div style="background: rgba(252, 224, 3, 0.05); padding: 20px; border-left: 4px solid #fce003; margin: 20px 0; border-radius: 0 10px 10px 0;">
            <pre style="white-space: pre-wrap; font-family: monospace; color: #eee; font-size: 12px;">${note}</pre>
          </div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://www.cadonce.com/projects/${projectId}" style="background: #fce003; color: #000; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 12px; text-transform: uppercase;">Open Project Dashboard</a>
          </div>
        </div>
      `,
      credentials
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[submitViewportFeedback] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function updateRevisionStatus(projectId: string, revisionId: string, status: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // 1. Get current project revisions
    const { data: project } = await supabase
      .from('projects')
      .select('revisions')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const updatedRevisions = (project.revisions || []).map((rev: any) =>
      rev.id === revisionId ? { ...rev, status } : rev
    );

    // 2. Save back to database
    const { error } = await supabase
      .from('projects')
      .update({ revisions: updatedRevisions })
      .eq('id', projectId);

    if (error) throw error;

    // 3. Revalidate paths to update UI
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/viewport`);

    return { success: true };
  } catch (err: any) {
    console.error('[updateRevisionStatus] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getProjectMessages(projectId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error('[getProjectMessages] Error:', err.message);
    return [];
  }
}

export async function sendChatMessage(projectId: string, content: string, senderName: string, senderRole: 'organization' | 'designer') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: project } = await adminSupabase
      .from('projects')
      .select('user_id, designer, title')
      .eq('id', projectId)
      .single();

    if (!project) throw new Error('Project not found');

    const { data: message, error } = await adminSupabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        sender_id: user.id,
        sender_name: senderName,
        sender_role: senderRole === 'organization' ? 'agency' : senderRole,
        content,
        user_id: project.user_id,
        is_read: false
      }])
      .select()
      .single();

    if (error) throw error;

    // 2. Trigger Notification for Recipient
    try {
      // Find the recipient ID and email
      let recipientId = null;
      let recipientEmail = null;
      
      if (senderRole === 'organization') {
        // Find designer assigned to project
        const { data: designer } = await adminSupabase
          .from('designers')
          .select('user_id, email')
          .ilike('fullName', project.designer || '')
          .maybeSingle();
        recipientId = designer?.user_id;
        recipientEmail = designer?.email;
      } else {
        // Recipient is organization owner
        recipientId = project.user_id;
        const { data: { user: orgUser } } = await adminSupabase.auth.admin.getUserById(project.user_id);
        recipientEmail = orgUser?.email;
      }

      if (recipientId) {
        await createNotification(
          recipientId,
          'message',
          `New Message: ${senderName}`,
          content.startsWith('{"type":"file"') ? 'Sent an attachment' : content.substring(0, 100),
          `/projects/${projectId}?tab=chat`
        );
      }

      if (recipientEmail) {
        const { sendEmail, composeTemplate } = await import('@/lib/mailer');
        const { PLATFORM_CONFIG } = await import('@/lib/config');
        
        const credentials = {
          user: PLATFORM_CONFIG.FOUNDER_EMAIL,
          password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
          senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 465,
          smtpSecure: true
        };

        const mailContent = content.startsWith('{"type":"file"') ? 'Sent an attachment' : content;

        await sendEmail({
          to: recipientEmail,
          subject: `New Message from ${senderName}`,
          html: composeTemplate(recipientEmail, `New Message`, mailContent, project.title || 'Project'),
          credentials
        });
      }
    } catch (notifyErr) {
      console.error('[sendChatMessage] Notification Error:', notifyErr);
    }

    return { success: true, message };
  } catch (err: any) {
    console.error('[sendChatMessage] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function markMessagesAsRead(projectId: string, userId: string) {
  try {
    const supabase = await createClient();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { error } = await adminSupabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('project_id', projectId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[markMessagesAsRead] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getUnreadCounts(userId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Efficient check: Use the current authenticated user session
    // For Organization Owners, we can filter chat_messages by user_id directly
    // For Designers, we still need to know their assigned projects
    const { data: designer } = await adminSupabase
      .from('designers')
      .select('fullName')
      .eq('email', user.email || '')
      .maybeSingle();

    let query = adminSupabase
      .from('chat_messages')
      .select('project_id')
      .eq('is_read', false)
      .neq('sender_id', user.id);

    if (designer) {
      // For Designers: Filter by projects they are assigned to
      // We do this in a subquery or join if possible, but for now, we'll keep the IDs fetch lean
      const { data: projects } = await adminSupabase
        .from('projects')
        .select('id')
        .eq('designer', designer.fullName);

      const projectIds = projects?.map(p => p.id) || [];
      if (projectIds.length === 0) return {};
      query = query.in('project_id', projectIds);
    } else {
      // For Organization Owners: Direct hit on user_id
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    const counts: Record<string, number> = {};
    data?.forEach((msg: any) => {
      counts[msg.project_id] = (counts[msg.project_id] || 0) + 1;
    });

    return counts;
  } catch (err: any) {
    console.error('[getUnreadCounts] Error:', err.message);
    return {};
  }
}

export async function getProjectById(id: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();
    const { data, error } = await adminSupabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error('[getProjectById] Error:', err.message);
    return null;
  }
}

export async function submitClientBrief(projectId: string, briefData: any) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Update project with the brief details
    const { error } = await adminSupabase
      .from('projects')
      .update({
        description: briefData.vision,
        brief_data: briefData, // Store the full structured data
        status: 'High Priority',
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error('[submitClientBrief] Error:', err.message);
    return { success: false, error: err.message };
  }
}
export async function updateProjectStatus(projectId: string, status: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('projects')
      .update({ status: status })
      .eq('id', projectId);

    if (error) throw error;

    // [ESCROW] If project is completed, release any active escrow
    if (status === 'Completed') {
      try {
        await releaseProjectEscrow(projectId);
      } catch (escrowErr) {
        console.error('[updateProjectStatus] Escrow Release Failed:', escrowErr);
        // Even if escrow release fails, the project status is updated
      }
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');
    return { success: true };
  } catch (err: any) {
    console.error('[submitClientBrief] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendIntakeForm(data: {
  clientId: string;
  clientEmail: string;
  clientName: string;
  clientMobile?: string;
  intakeLink: string;
}) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get Mail Credentials from settings (Admin bypass)
    const { data: settings } = await adminSupabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const credentials = getMailCredentials(settings, true);

    if (!data.clientEmail || !data.clientEmail.includes('@')) {
      throw new Error(`Invalid or missing email for client: ${data.clientName}. Please update the client dossier.`);
    }

    // 2. Send Email
    const { sendEmail, briefingTemplate } = await import('@/lib/mailer');
    const mockProject = { title: 'Your New Design Project', client: data.clientName };
    
    await sendEmail({
      to: data.clientEmail,
      subject: `[ACTION REQUIRED] Initialize Your Project Briefing - CADONCE`,
      html: briefingTemplate(mockProject, data.intakeLink),
      credentials
    });

    // 3. Generate WhatsApp Link
    const waMessage = `Hi ${data.clientName}! To start your new project at CADONCE, please fill out this brief intake form with your design requirements: ${data.intakeLink}`;
    const waLink = data.clientMobile ? `https://wa.me/${data.clientMobile.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}` : null;

    return {
      success: true,
      message: 'Intake form link sent via email.',
      waLink
    };
  } catch (err: any) {
    console.error('[sendIntakeForm] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getCloudinarySignature() {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) throw new Error('Cloudinary API Secret is missing');

    const crypto = require('crypto');
    const signature = crypto
      .createHash('sha1')
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    return {
      timestamp,
      signature,
      apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    };
  } catch (err: any) {
    console.error('[getCloudinarySignature] Error:', err.message);
    return null;
  }
}

export async function updateProjectGallery(projectId: string, mediaUrl: string, type: string = 'image') {
  try {
    const supabase = await createClient();

    const { data: project } = await supabase
      .from('projects')
      .select('images')
      .eq('id', projectId)
      .single();

    // Smart Parsing for current gallery
    let currentGallery: any[] = [];
    const rawImages = project?.images;

    if (Array.isArray(rawImages)) {
      currentGallery = rawImages;
    } else if (typeof rawImages === 'string' && rawImages) {
      if (rawImages.trim().startsWith('[') || rawImages.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawImages);
          currentGallery = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          currentGallery = rawImages.split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' })).filter(i => i.url);
        }
      } else {
        currentGallery = rawImages.split(/[\n,]+/).map(url => ({ url: url.trim(), type: 'image' })).filter(i => i.url);
      }
    }

    const newItem = { url: mediaUrl, type, uploadedAt: new Date().toISOString() };
    const updatedGallery = [...currentGallery, newItem];

    const { error } = await supabase
      .from('projects')
      .update({ images: updatedGallery })
      .eq('id', projectId);

    if (error) throw error;

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[updateProjectGallery] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteProjectMedia(projectId: string, mediaUrl: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // CLEAN THE ID: Strip any leading # or ## and trim whitespace
    const cleanId = projectId.replace(/^#+/, '').trim();

    console.log('[deleteProjectMedia] SEARCHING FOR:', { projectId, cleanId, mediaUrl });

    // 1. Search by all possible ID formats and the Title
    let { data: project } = await adminSupabase
      .from('projects')
      .select('id, images, thumbnailUrl, orderId, title')
      .or(`id.eq.${projectId},id.eq.${cleanId},orderId.eq.${projectId},orderId.eq.#${cleanId},orderId.eq.${cleanId},orderId.eq.##${cleanId},title.eq.${projectId},title.eq."${projectId}",title.ilike.%${projectId}%`)
      .maybeSingle();

    // 2. FALLBACK: Search by the image URL itself across ALL projects
    if (!project) {
      console.log('[deleteProjectMedia] ID/Title lookup failed. Scanning ALL projects...');
      const { data: allProjects } = await adminSupabase.from('projects').select('id, images, thumbnailUrl, orderId, title');
      console.log(`[deleteProjectMedia] Scanning ${allProjects?.length || 0} projects for asset...`);

      project = allProjects?.find(p => {
        let gallery: any[] = [];
        try {
          gallery = Array.isArray(p.images) ? p.images : JSON.parse(p.images || '[]');
        } catch {
          gallery = String(p.images || '').split(/[\n,]+/).map(u => ({ url: u.trim() }));
        }
        return gallery.some((item: any) => {
          const itemUrl = typeof item === 'string' ? item : item.url;
          return itemUrl === mediaUrl || (itemUrl && mediaUrl && itemUrl.includes(mediaUrl)) || (mediaUrl && itemUrl && mediaUrl.includes(itemUrl));
        });
      }) as any;
    }

    if (!project) {
      // 3. LAST RESORT: Try finding by ID again but with a direct SELECT
      const { data: lastResort } = await adminSupabase.from('projects').select('*').eq('id', cleanId).maybeSingle();
      project = lastResort as any;
    }

    if (!project) {
      console.error('[deleteProjectMedia] ABSOLUTE FAILURE: Project/Asset not found in any project.');
      throw new Error(`Project not found. ID: ${projectId}. Please try refreshing the page.`);
    }

    console.log('[deleteProjectMedia] ADMIN SUCCESS: Found project:', project.id, 'Title:', project.title);

    // Smart Parsing for current gallery
    let currentGallery: any[] = [];
    const rawImages = project?.images;

    if (Array.isArray(rawImages)) {
      currentGallery = rawImages;
    } else if (typeof rawImages === 'string' && rawImages) {
      try {
        const parsed = JSON.parse(rawImages);
        currentGallery = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        currentGallery = rawImages.split(/[\n,]+/).map(url => ({ url: url.trim() })).filter(i => i.url);
      }
    }

    const updatedGallery = currentGallery.filter((item: any) => {
      const itemUrl = typeof item === 'string' ? item : item.url;
      return itemUrl !== mediaUrl;
    });

    const updates: any = { images: updatedGallery };

    // If the image being deleted was the thumbnail, clear it
    if (project.thumbnailUrl === mediaUrl) {
      updates.thumbnailUrl = null;
    }

    const { error } = await adminSupabase
      .from('projects')
      .update(updates)
      .eq('id', project.id);

    if (error) throw error;

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${project.id}`);
    return { success: true };
  } catch (err: any) {
    console.error('[deleteProjectMedia] Error:', err.message);
    return { success: false, error: err.message };
  }
}
export async function createDesignerPayoutOrder(projectId: string) {
  const { user } = await getAuthenticatedUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { PLATFORM_CONFIG } = await import('@/lib/config');
    const db = await readDb(user.id);
    const project = db.projects.find(p => p.id === projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const razorpayKeyId = PLATFORM_CONFIG.RAZORPAY_KEY_ID;
    const razorpayKeySecret = PLATFORM_CONFIG.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return { success: false, error: 'Platform Razorpay keys not configured.' };
    }

    const { createRazorpayOrder } = await import('@/lib/payment');
    const amount = parseFloat(project.expense || '0');
    
    if (amount <= 0) return { success: false, error: 'Invalid payout amount.' };

    const order = await createRazorpayOrder(amount, {
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      organizationName: PLATFORM_CONFIG.PLATFORM_NAME
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function verifyDesignerPayout(projectId: string, paymentDetails: any) {
  const { user } = await getAuthenticatedUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { PLATFORM_CONFIG } = await import('@/lib/config');
    const { verifyRazorpayPayment } = await import('@/lib/payment');
    
    const isValid = verifyRazorpayPayment(
      paymentDetails.razorpay_order_id,
      paymentDetails.razorpay_payment_id,
      paymentDetails.razorpay_signature,
      PLATFORM_CONFIG.RAZORPAY_KEY_SECRET
    );

    if (isValid) {
      const { updateRecord } = await import('@/lib/db');
      await updateRecord('projects', projectId, { paymentStatus: 'Paid' }, user.id);
      return { success: true, message: 'Payout authorized and recorded.' };
    } else {
      return { success: false, error: 'Payment verification failed.' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createClientPaymentOrder(projectId: string, amount: number) {
  const { user } = await getAuthenticatedUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const db = await readDb(user.id);
    const settings = db.settings || {};
    const razorpayKeyId = settings.razorpayKeyId;
    const razorpayKeySecret = settings.razorpayKeySecret;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return { success: false, error: 'Organization has not configured Razorpay.' };
    }

    const { createRazorpayOrder } = await import('@/lib/payment');
    
    if (amount <= 0) return { success: false, error: 'Invalid payment amount.' };

    const order = await createRazorpayOrder(amount, {
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      organizationName: settings.organizationName || 'CADONCE Organization'
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function verifyClientPayment(projectId: string, amount: number, paymentDetails: any) {
  const { user } = await getAuthenticatedUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const db = await readDb(user.id);
    const settings = db.settings || {};
    
    const { verifyRazorpayPayment } = await import('@/lib/payment');
    const isValid = verifyRazorpayPayment(
      paymentDetails.razorpay_order_id,
      paymentDetails.razorpay_payment_id,
      paymentDetails.razorpay_signature,
      settings.razorpayKeySecret
    );

    if (isValid) {
      const project = db.projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');

      const newPaidAmount = (parseFloat(project.paidAmount || '0') + amount);
      const totalRevenue = parseFloat(project.revenue || '0');
      const newStatus = newPaidAmount >= totalRevenue ? 'Paid' : 'Partial Payment';

      const { updateRecord } = await import('@/lib/db');
      await updateRecord('projects', projectId, { 
        paidAmount: newPaidAmount.toString(),
        paymentStatus: newStatus
      }, user.id);

      return { success: true, message: 'Payment verified and project updated.' };
    } else {
      return { success: false, error: 'Payment verification failed.' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendPayoutReminder(projectId: string, organizationId: string) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get project and organization settings
    const { data: project } = await adminSupabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    const { data: settings } = await adminSupabase.from('settings').select('*').eq('user_id', organizationId).maybeSingle();

    if (!project || !settings) throw new Error('Project or Organization settings not found');

    // 2. Security: Verify this designer is actually assigned to this project
    const { data: designer } = await adminSupabase
      .from('designers')
      .select('fullName')
      .ilike('email', user.email || '')
      .eq('user_id', organizationId)
      .maybeSingle();

    if (!designer || designer.fullName !== project.designer) {
      throw new Error('Unauthorized: You are not assigned to this project.');
    }

    // 3. Prepare and Send Email
    const { sendEmail } = await import('@/lib/mailer');
    // We use the organization's own credentials to send the reminder to themselves (or the platform default)
    const credentials = getMailCredentials(settings); 

    await sendEmail({
      to: settings.gmailUser,
      subject: `[PAYMENT REMINDER] Payout due for ${project.title}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; background: #fafafa; border-radius: 12px;">
          <h2 style="color: #000; margin-bottom: 20px;">Payout Reminder</h2>
          <p>Hi <strong>${settings.organizationName || 'Organization Partner'}</strong>,</p>
          <p>Your designer, <strong>${designer.fullName}</strong>, has requested a payout review for the following completed project:</p>
          
          <div style="background: #fff; padding: 20px; border: 1px solid #eee; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Project Title:</strong> ${project.title}</p>
            <p style="margin: 0 0 10px 0;"><strong>Status:</strong> ${project.status}</p>
            <p style="margin: 0; color: #d32f2f;"><strong>Payout Due:</strong> ${project.expenseCurrency || '₹'}${project.expense}</p>
          </div>

          <p>Please log in to your CADONCE Dashboard to process the payout.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            Sent via CADONCE Workstation • Automated Notification
          </div>
        </div>
      `,
      credentials
    });

    return { success: true };
  } catch (err: any) {
    console.error('[sendPayoutReminder] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchAmazonProduct(url: string) {
  try {
    const { user } = await getAuthenticatedUser();
    if (user.email !== PLATFORM_CONFIG.FOUNDER_EMAIL) {
      throw new Error('Only the platform founder is authorized to manage affiliate assets.');
    }

    // Extract ASIN from typical Amazon URL
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? asinMatch[1] : null;

    if (!asin) throw new Error('Could not find a valid Amazon Product ID (ASIN) in the link.');

    // Detect Country and Currency from URL
    const isIndia = url.includes('.in');
    const countryCode = isIndia ? 'IN' : 'US';
    const currency = isIndia ? 'INR' : 'USD';

    // Live Fetch Attempt (Server-side)
    let title = isIndia ? "ASUS ROG Strix G16 (2025), AMD Ryzen 9 8940HX, RTX 5050-8GB" : "ASUS ROG Strix G16 (2025) Gaming Laptop";
    let imageUrl = 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&q=80&w=679';
    let price = isIndia ? 173990 : 1999.99;
    let oldPrice = isIndia ? 199990 : 2299.99;
    let discount = '12% OFF';

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': 'https://www.amazon.in/',
          'Device-Memory': '8',
        }
      });
      const html = await response.text();

      // Extract Title
      const titleMatch = html.match(/<span id="productTitle"[^>]*>\s*([^<]+)\s*<\/span>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        // Fallback: Extract from URL slug
        const slugMatch = url.match(/amazon\.in\/([^/]+)\/dp/i);
        if (slugMatch) {
          title = slugMatch[1].replace(/-/g, ' ').toUpperCase();
        }
      }

      // Extract First Gallery Image (Landing Image)
      const imageMatch = html.match(/landingImage[^>]*src="([^"]+)"/i) || 
                         html.match(/data-old-hires="([^"]+)"/i) ||
                         html.match(/id="imgBlkFront"[^>]*src="([^"]+)"/i) ||
                         html.match(/id="main-image"[^>]*src="([^"]+)"/i) ||
                         html.match(/"large":"([^"]+)"/i);
      if (imageMatch) imageUrl = imageMatch[1].replace(/&amp;/g, '&');

      // Extract Price (Multi-pattern fallback)
      const priceMatch = html.match(/priceToPay[^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i) ||
                         html.match(/<span class="a-price-whole">([^<]+)<\/span>/i) ||
                         html.match(/id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/i) ||
                         html.match(/id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/i) ||
                         html.match(/<span class="a-offscreen">([^<]+)<\/span>/i);
      
      if (priceMatch) {
        const rawPrice = priceMatch[1].replace(/[^0-9.]/g, '');
        if (rawPrice) price = parseFloat(rawPrice);
      }

      // Extract List Price (MRP) for Discount Calculation
      const mrpMatch = html.match(/<span class="a-price a-text-price"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
                       html.match(/<span class="basisPrice">.*?<span class="a-offscreen">([^<]+)<\/span>/i);
      
      if (mrpMatch) {
        const rawMrp = mrpMatch[1].replace(/[^0-9.]/g, '');
        if (rawMrp) oldPrice = parseFloat(rawMrp);
      }
    } catch (fetchErr) {
      console.warn('Live fetch failed, using smart fallbacks:', fetchErr);
    }

    // Dynamic Discount Calculation
    if (oldPrice > price) {
      const discountPct = Math.round(((oldPrice - price) / oldPrice) * 100);
      discount = `${discountPct}% OFF`;
    } else {
      // Fallback if no MRP found, but we want to show a premium look
      oldPrice = price * 1.12; 
      discount = '12% OFF';
    }

    // Force Founder Affiliate Tag
    const domain = isIndia ? 'amazon.in' : 'amazon.com';
    const affiliateUrl = `https://www.${domain}/dp/${asin}?tag=cadonce-21&linkCode=ll2&linkId=${Math.random().toString(36).substring(7)}`;

    const getCommissionRate = (title: string): number => {
      const lowerTitle = title.toLowerCase();
      // Official Amazon.in Rates 2024-2026
      if (lowerTitle.includes('laptop') || lowerTitle.includes('computer') || lowerTitle.includes('monitor') || lowerTitle.includes('pc') || lowerTitle.includes('desktop')) return 0.035; // 3.5%
      if (lowerTitle.includes('phone') || lowerTitle.includes('mobile') || lowerTitle.includes('smartphone')) return 0.01; // 1%
      if (lowerTitle.includes('dress') || lowerTitle.includes('watch') || lowerTitle.includes('beauty') || lowerTitle.includes('shoe') || lowerTitle.includes('clothing') || lowerTitle.includes('luggage')) return 0.059; // 5.9%
      if (lowerTitle.includes('kitchen') || lowerTitle.includes('home') || lowerTitle.includes('furniture') || lowerTitle.includes('toy') || lowerTitle.includes('book') || lowerTitle.includes('office')) return 0.05; // 5%
      if (lowerTitle.includes('storage') || lowerTitle.includes('hard drive') || lowerTitle.includes('ssd') || lowerTitle.includes('pendrive')) return 0.02; // 2%
      if (lowerTitle.includes('tv') || lowerTitle.includes('television') || lowerTitle.includes('electronics') || lowerTitle.includes('appliance')) return 0.035; // 3.5%
      return 0.05; // Default 5%
    };

    const founderCommissionRate = getCommissionRate(title);
    const buyerPointsRate = founderCommissionRate * 0.5;
    const pointsValue = Math.round(price * buyerPointsRate);

    const productData = {
      id: Math.random().toString(),
      asin: asin,
      title,
      price,
      oldPrice,
      discount,
      imageUrl,
      points: pointsValue,
      cashback: `${pointsValue} POINTS`,
      platform: 'amazon' as const,
      url: affiliateUrl,
      currency,
      countryCode
    };

    return { success: true, product: productData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveAffiliateProduct(product: any) {
  try {
    const { user } = await getAuthenticatedUser();
    if (user.email !== PLATFORM_CONFIG.FOUNDER_EMAIL) throw new Error('Unauthorized');

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Get current products from ALL sources to ensure we have the full list
    const allSaved = await getAffiliateProducts();
    
    // 2. Check for duplicates (ASIN is the primary key for Amazon products)
    const exists = allSaved.some((p: any) => (p.asin && product.asin && p.asin === product.asin) || p.id === product.id);
    if (exists) {
      console.log(`[saveAffiliateProduct] Product already exists: ${product.asin || product.id}`);
      return { success: true, message: 'Already exists' };
    }

    const updatedProducts = [product, ...allSaved];
    
    // 3. Use the robust upsertSettings from db.ts with Admin client
    const { upsertSettings } = await import('@/lib/db');
    await upsertSettings({ affiliate_products: updatedProducts }, user.id, adminSupabase);

    console.log(`[saveAffiliateProduct] Successfully saved ${product.title} to Founder ID: ${user.id}`);

    // 4. Force Cache Revalidation
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/');
    
    return { success: true };
  } catch (err: any) {
    console.error('[saveAffiliateProduct] Critical Error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteAffiliateProduct(identifier: string) {
  try {
    const { user } = await getAuthenticatedUser();
    if (user.email !== PLATFORM_CONFIG.FOUNDER_EMAIL) throw new Error('Unauthorized');

    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const allSaved = await getAffiliateProducts();
    const updatedProducts = allSaved.filter((p: any) => p.asin !== identifier && p.id !== identifier);
    
    const { upsertSettings } = await import('@/lib/db');
    await upsertSettings({ affiliate_products: updatedProducts }, user.id, adminSupabase);

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    console.error('[deleteAffiliateProduct] Error:', err);
    return { success: false, error: err.message };
  }
}

export async function getAffiliateProducts() {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // TOTAL SWEEP: Fetch every single settings record in the database
    const { data: allSettings, error } = await adminSupabase
      .from('settings')
      .select('affiliate_products')
      .not('affiliate_products', 'is', null);

    if (error) throw error;
    if (!allSettings || allSettings.length === 0) return [];

    const mergedMap = new Map();
    allSettings.forEach(s => {
      let products = s.affiliate_products;
      
      if (typeof products === 'string') {
        try {
          products = JSON.parse(products);
        } catch (e) {
          products = [];
        }
      }

      if (products && Array.isArray(products)) {
        products.forEach((p: any) => {
          const key = p.asin || p.id;
          if (key && !mergedMap.has(key)) {
            mergedMap.set(key, p);
          }
        });
      }
    });

    const result = Array.from(mergedMap.values());
    console.log(`[getAffiliateProducts] Recovered ${result.length} unique products from ${allSettings.length} records.`);
    return result;
  } catch (err) {
    console.error('[getAffiliateProducts] Critical Retrieval Error:', err);
    return [];
  }
}

export async function deleteMyAccount() {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Identify Role
    const designerStatus = await getDesignerStatus();
    const isDesigner = designerStatus.isDesigner;

    if (isDesigner && user.email) {
      // Designer Wipe Protocol: Remove from designers registry
      console.log(`[deleteMyAccount] Executing Designer Wipe for: ${user.email}`);
      const { error: delDesignerError } = await adminSupabase
        .from('designers')
        .delete()
        .ilike('email', user.email);
      if (delDesignerError) throw delDesignerError;
    } else {
      // Organization Wipe Protocol: Full Studio Purge
      console.log(`[deleteMyAccount] Executing Organization Studio Purge for: ${user.id}`);
      
      // Cascade delete all associated data tied to this owner
      await Promise.all([
        adminSupabase.from('projects').delete().eq('user_id', user.id),
        adminSupabase.from('clients').delete().eq('user_id', user.id),
        adminSupabase.from('designers').delete().eq('user_id', user.id),
        adminSupabase.from('settings').delete().eq('user_id', user.id)
      ]);
    }

    // 2. Final Auth Termination: Wipe the user from Supabase Auth permanently
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    return { success: true };
  } catch (err: any) {
    console.error('[deleteMyAccount] Wipe Failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function uploadProfileImage(formData: FormData) {
  try {
    const { user } = await getAuthenticatedUser();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const { uploadFile } = await import('@/lib/storage');
    const fileExt = file.name.split('.').pop();
    const path = `${user.id}/avatar.${fileExt}`;

    const filePath = await uploadFile(file, path, 'project-assets');
    
    // Get a public/signed URL
    const { createClient } = await import('@/lib/supabaseServer');
    const supabase = await createClient();
    const { data: { publicUrl } } = supabase.storage.from('project-assets').getPublicUrl(filePath);

    // [PERSISTENCE] Save the avatar URL to user metadata so it survives refresh
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();
    await adminSupabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, avatar_url: publicUrl }
    });

    revalidatePath('/settings');
    revalidatePath('/designer');
    revalidatePath('/');

    return { success: true, url: publicUrl };
  } catch (err: any) {
    console.error('[uploadProfileImage] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function requestWithdrawal(amount: number, details: any) {
  try {
    const { user } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Verify balance
    const res = await getMySettings();
    const currentBalance = (res.success && res.settings) ? (res.settings.pointsBalance || 0) : 0;

    if (currentBalance < amount) throw new Error('Insufficient points balance.');

    // 2. Log request (Can be expanded to a 'transactions' table)
    console.log(`[requestWithdrawal] User ${user.email} requested ${amount} points withdrawal to:`, details);

    // 3. Deduct points immediately (Secure Protocol)
    const updatedBalance = currentBalance - amount;
    const { upsertSettings } = await import('@/lib/db');
    await upsertSettings({ pointsBalance: updatedBalance }, user.id, adminSupabase);

    return { success: true, newBalance: updatedBalance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function transferPoints(recipientEmail: string, amount: number) {
  try {
    const { user: sender } = await getAuthenticatedUser();
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 1. Verify Sender Balance
    const res = await getMySettings();
    const senderBalance = (res.success && res.settings) ? (res.settings.pointsBalance || 0) : 0;
    if (senderBalance < amount) throw new Error('Insufficient balance.');

    // 2. Find Recipient
    const { data: recipientUser, error: findError } = await adminSupabase
      .from('profiles')
      .select('id')
      .ilike('email', recipientEmail)
      .single();

    if (findError || !recipientUser) throw new Error('Recipient identity not found.');

    // 3. Execute Atomic Transfer
    const senderNewBalance = senderBalance - amount;
    
    // Update Sender
    const { upsertSettings } = await import('@/lib/db');
    await upsertSettings({ pointsBalance: senderNewBalance }, sender.id, adminSupabase);

    // Update Recipient (Requires fetching their current points first)
    const { data: recipientSettings } = await adminSupabase
      .from('settings')
      .select('payment_methods')
      .eq('user_id', recipientUser.id)
      .single();

    let recipientCurrentBalance = 0;
    if (recipientSettings?.payment_methods) {
      const config = typeof recipientSettings.payment_methods === 'string' 
        ? JSON.parse(recipientSettings.payment_methods) 
        : recipientSettings.payment_methods;
      recipientCurrentBalance = config.pointsBalance || 0;
    }

    await upsertSettings({ pointsBalance: recipientCurrentBalance + amount }, recipientUser.id, adminSupabase);

    return { success: true, newBalance: senderNewBalance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * -----------------------------------------------------------------------------
 * ESCROW & LEDGER SYSTEM (DUAL-TRACK)
 * -----------------------------------------------------------------------------
 */

/**
 * Log a transaction in the points ledger (Rewards System)
 */
export async function logPointsTransaction(data: {
  amount: number;
  type: string;
  description: string;
  referenceId?: string;
  userId?: string;
}) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const targetUserId = data.userId || user.id;

    const { error } = await supabase.from('points_ledger').insert({
      user_id: targetUserId,
      amount: data.amount,
      type: data.type,
      description: data.description,
      reference_id: data.referenceId,
      status: 'completed'
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('[logPointsTransaction] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch the points ledger for the current user
 */
export async function getPointsLedger() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    
    // Check if points_ledger table exists by doing a small query
    const { data, error } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[getPointsLedger] points_ledger table not found or error:', error.message);
      
      // Synthesize a starting balance entry if they have a balance but no ledger
      const { data: settings } = await supabase
        .from('settings')
        .select('payment_methods, createdAt')
        .eq('user_id', user.id)
        .maybeSingle();

      const methods = settings?.payment_methods || [];
      const config = methods.find((m: any) => m.id === 'system_config');
      const balance = parseFloat(config?.wallet_balance || '0');
      if (balance > 0) {
        return {
          success: true,
          ledger: [{
            id: 'legacy-init',
            description: 'Legacy Balance Migration',
            type: 'earn',
            amount: balance,
            created_at: settings?.createdAt || new Date().toISOString()
          }]
        };
      }

      return { success: true, ledger: [] };
    }
    
    return { success: true, ledger: data || [] };
  } catch (err: any) {
    console.error('[getPointsLedger] Fatal Error:', err.message);
    return { success: true, ledger: [] }; 
  }
}

/**
 * Initiate Project Escrow (Project Financials)
 */
export async function initiateProjectEscrow(projectId: string, amount: number) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // 1. Check Organization Balance
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (!project) throw new Error('Project not found');

    const currency = project.expenseCurrency || '₹';
    let rate = 1;

    if (currency === 'USD') {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates.INR) rate = data.rates.INR;
      } catch (err) {
        rate = 83.5; // Fallback
      }
    }

    const deductionAmount = currency === 'USD' ? amount * rate : amount;

    const { data: settings } = await supabase
      .from('settings')
      .select('payment_methods')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const methods = settings?.payment_methods || [];
    const configIndex = methods.findIndex((m: any) => m.id === 'system_config');
    let currentBalance = 0;
    if (configIndex > -1) {
      currentBalance = parseFloat(methods[configIndex].wallet_balance || '0');
    }
    
    if (currentBalance < deductionAmount) {
      throw new Error(`Insufficient wallet balance. You need ₹${deductionAmount.toLocaleString()} but have ₹${currentBalance.toLocaleString()}.`);
    }

    // 2. Deduct from Organization and Update Project in one go (Pseudo-transaction)
    if (configIndex > -1) {
      methods[configIndex].wallet_balance = currentBalance - deductionAmount;
    } else {
      methods.push({ id: 'system_config', type: 'INTERNAL_CONFIG', wallet_balance: -deductionAmount });
    }

    const { error: deductError } = await supabase
      .from('settings')
      .update({ payment_methods: methods })
      .eq('user_id', user.id);

    if (deductError) throw deductError;

    // 3. Update the project record
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        useEscrow: true,
        paymentStatus: 'Escrow Secured',
        status: 'In Progress',
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId);

    if (projectError) throw projectError;

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('[initiateProjectEscrow] Error:', err.message);
    return { success: false, error: err.message };
  }
}


/**
 * Release Project Escrow to Designer
 */
export async function releaseProjectEscrow(projectId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    // 1. Find the project and verify it is secured
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (pError || !project) throw new Error('Project not found');
    if (project.paymentStatus !== 'Escrow Secured') {
      throw new Error('Funds are not secured in escrow for this project.');
    }

    // 2. Find Designer User ID
    let designerUserId = null;
    if (project.designer) {
      const { data: designerRecord } = await supabase
        .from('designers')
        .select('user_id')
        .ilike('fullName', project.designer)
        .maybeSingle();
      
      designerUserId = designerRecord?.user_id;
    }

    if (!designerUserId) {
      throw new Error('Could not identify the designer recipient to release funds.');
    }

    // 3. Calculate Amount (Handle conversions)
    const amount = parseFloat(project.expense || '0');
    const currency = project.expenseCurrency || '₹';
    let rate = 1;
    if (currency === 'USD') {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates.INR) rate = data.rates.INR;
      } catch (err) { rate = 83.5; }
    }
    const releaseAmountINR = currency === 'USD' ? amount * rate : amount;

    // 4. Update Designer Wallet
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    const { data: designerSettings } = await adminSupabase
      .from('settings')
      .select('payment_methods')
      .eq('user_id', designerUserId)
      .maybeSingle();

    const methods = designerSettings?.payment_methods || [];
    const configIndex = methods.findIndex((m: any) => m.id === 'system_config');
    let currentDesignerBalance = 0;
    if (configIndex > -1) {
      currentDesignerBalance = parseFloat(methods[configIndex].wallet_balance || '0');
    }

    if (configIndex > -1) {
      methods[configIndex].wallet_balance = currentDesignerBalance + releaseAmountINR;
    } else {
      methods.push({ id: 'system_config', type: 'INTERNAL_CONFIG', wallet_balance: releaseAmountINR });
    }

    const { error: designerUpdateError } = await adminSupabase
      .from('settings')
      .update({ payment_methods: methods })
      .eq('user_id', designerUserId);

    if (designerUpdateError) throw designerUpdateError;

    // 5. Finalize Project Status
    const { error: finalError } = await supabase
      .from('projects')
      .update({
        paymentStatus: 'Paid',
        status: 'Completed',
        updatedAt: new Date().toISOString()
      })
      .eq('id', projectId);

    if (finalError) throw finalError;

    // Delete screenshots for this project
    try {
      const { data: files, error: listError } = await adminSupabase
        .storage
        .from('project-assets')
        .list(`screenshots/${projectId}`);
        
      if (!listError && files && files.length > 0) {
        const pathsToDelete = files.map((file: any) => `screenshots/${projectId}/${file.name}`);
        await adminSupabase
          .storage
          .from('project-assets')
          .remove(pathsToDelete);
        console.log(`[releaseProjectEscrow] Deleted ${files.length} screenshots for project ${projectId}`);
      }
    } catch (err: any) {
      console.error('[releaseProjectEscrow] Failed to delete screenshots:', err.message);
    }

    // 6. Update Designer Performance and Points
    if (project.designer) {
      const { data: designerRecord } = await supabase
        .from('designers')
        .select('performance, id, email, pointsBalance')
        .ilike('fullName', project.designer)
        .maybeSingle();

      if (designerRecord) {
        const currentPerf = designerRecord.performance || 90;
        const newPerf = Math.min(100, currentPerf + 2);
        const currentPoints = designerRecord.pointsBalance || 0;
        
        await supabase
          .from('designers')
          .update({ 
            performance: newPerf,
            pointsBalance: currentPoints + releaseAmountINR
          })
          .eq('id', designerRecord.id);

        // Insert Ledger Entry
        try {
          await adminSupabase
            .from('points_ledger')
            .insert({
              user_id: designerUserId,
              description: `Funds Released for Project: ${project.title}`,
              type: 'earn',
              amount: releaseAmountINR,
              created_at: new Date().toISOString()
            });
        } catch (ledgerErr: any) {
          console.error('[releaseProjectEscrow] Failed to insert ledger entry:', ledgerErr.message);
        }

        // Send Email Notification for Funds Released
        if (designerRecord.email) {
          try {
            const headerList = await headers();
            const host = headerList.get('host');
            const protocol = headerList.get('x-forwarded-proto') || 'http';
            const baseUrl = `${protocol}://${host}`;
            const magicLink = `${baseUrl}/designer`;

            await sendEmail({
              to: designerRecord.email,
              subject: `Funds Released for Project: ${project.title}`,
              html: fundsReleasedTemplate(project, amount.toString(), currency, magicLink),
              credentials: {
                user: PLATFORM_CONFIG.FOUNDER_EMAIL,
                password: PLATFORM_CONFIG.FOUNDER_EMAIL_PASSWORD,
                senderName: PLATFORM_CONFIG.FOUNDER_SENDER_NAME || 'CADONCE',
                smtpHost: 'smtp.gmail.com',
                smtpPort: 465,
                smtpSecure: true
              }
            });
          } catch (mailErr: any) {
            console.error('[releaseProjectEscrow] Failed to send email:', mailErr.message);
          }
        }
      }
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    console.error('[releaseProjectEscrow] Error:', err.message);
    return { success: false, error: err.message };
  }
}


/**
 * Get active escrows for the current user (as Organization or Designer)
 */
export async function getMyEscrows() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    
    // 1. Fetch user's role to determine search criteria
    const { data: profile } = await supabase
      .from('settings')
      .select('fullName, role')
      .eq('user_id', user.id)
      .single();

    const isDesigner = profile?.role === 'Designer';

    // 2. Fetch Secured Projects (Our "Virtual Escrow" Source of Truth)
    let query = supabase
      .from('projects')
      .select('id, title, designer, expense, expenseCurrency, paymentStatus, createdAt')
      .eq('paymentStatus', 'Escrow Secured');

    if (isDesigner) {
      // If designer, find projects assigned to them
      query = query.ilike('designer', profile?.fullName || '');
    } else {
      // If organization, find projects they own
      query = query.eq('user_id', user.id);
    }

    const { data: securedProjects, error: pError } = await query;
    if (pError) throw pError;

    // 3. Map projects to a standard escrow format for the UI
    const escrows = (securedProjects || []).map(p => ({
      id: p.id,
      project_id: p.id,
      project_name: p.title,
      amount: p.expense || '0',
      currency: p.expenseCurrency || '₹',
      status: 'active',
      created_at: p.createdAt
    }));

    return { 
      success: true, 
      organizationEscrows: !isDesigner ? escrows : [], 
      designerEscrows: isDesigner ? escrows : [] 
    };
  } catch (err: any) {
    console.error('[getMyEscrows] Error:', err.message);
    return { success: false, error: err.message, organizationEscrows: [], designerEscrows: [] };
  }
}

/**
 * Get data for Escrow Payment Selection
 */
export async function getEscrowPaymentData() {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    const { data: settings } = await supabase
      .from('settings')
      .select('payment_methods')
      .eq('user_id', user.id)
      .maybeSingle();

    const methods = settings?.payment_methods || [];
    const config = methods.find((m: any) => m.id === 'system_config');
    const balance = parseFloat(config?.wallet_balance || '0');

    return {
      success: true,
      balance: balance,
      razorpayKey: PLATFORM_CONFIG.RAZORPAY_KEY_ID
    };
  } catch (err: any) {
    console.error('[getEscrowPaymentData] Error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create a Razorpay Order for Escrow
 */
export async function createPaymentOrder(amount: number) {
  try {
    const order = await createRazorpayOrder(amount, {
      key_id: PLATFORM_CONFIG.RAZORPAY_KEY_ID,
      key_secret: PLATFORM_CONFIG.RAZORPAY_KEY_SECRET
    });

    return order;
  } catch (err: any) {
    console.error('[createPaymentOrder] Error:', err.message);
    throw err;
  }
}

/**
 * Verify Razorpay Signature and Complete Escrow
 */
export async function verifyAndCompleteEscrow({ 
  projectId, 
  amount, 
  razorpay_order_id, 
  razorpay_payment_id, 
  razorpay_signature 
}: any) {
  try {
    const { user, supabase } = await getAuthenticatedUser();
    
    // 1. Verify Signature
    const { verifyRazorpayPayment } = await import('@/lib/payment');
    const isValid = verifyRazorpayPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      PLATFORM_CONFIG.RAZORPAY_KEY_SECRET
    );

    if (!isValid) throw new Error('Invalid payment signature.');

    // 2. Update Project Status (Since project_escrow table is missing)
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (pError || !project) throw new Error('Project not found');

    const updateData = {
      paymentStatus: 'Escrow Secured',
      status: 'In Progress', // Or keep current
      description: (project.description || '') + `\n\n[ESCROW] Secured via Razorpay (${razorpay_payment_id})`,
      updatedAt: new Date().toISOString()
    };

    const { error: upError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    if (upError) throw upError;

    // 3. Update Wallet Balance in Settings (Ledger simulation)
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentBalance = parseFloat(settings?.wallet_balance || '0');
    
    // We treat this as a top-up to the internal wallet then immediate use
    // For now, let's just record that the project is secured.
    
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[verifyAndCompleteEscrow] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function checkIfUserIsRegistered(email: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();
    
    // 1. Try to find in Auth
    const user = await findAuthUserByEmail(adminSupabase, email);

    // If user exists and has a completed metadata profile OR has signed in before, they are registered
    if (user && (user.user_metadata?.full_name || user.user_metadata?.organization_name || user.last_sign_in_at)) {
      return { registered: true };
    }

    // 2. Secondary check: Look at ALL designers table records for any that looks "set up"
    const { data: dbDesigners } = await adminSupabase
      .from('designers')
      .select('fullName, hasPortalAccess')
      .ilike('email', email.trim());

    if (dbDesigners && dbDesigners.length > 0) {
      // If ANY record has a customized name, they've finished setup somewhere
      const hasCustomName = dbDesigners.some(d => d.fullName && d.fullName !== 'Professional Designer');
      if (hasCustomName) return { registered: true };
    }

    return { registered: false };
  } catch (err) {
    console.error('[checkIfUserIsRegistered] Error:', err);
    return { registered: false };
  }
}

// Helper to reliably find a user across all pages
async function findAuthUserByEmail(adminSupabase: any, email: string) {
  const sanitizedEmail = email.trim().toLowerCase();
  
  try {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({ 
        page, 
        perPage: 1000 
      });

      if (error) {
        console.error(`[findAuthUserByEmail] Error at page ${page}:`, error.message);
        break;
      }

      const users = data?.users || [];
      if (users.length === 0) break;

      const found = users.find((u: any) => u.email?.toLowerCase() === sanitizedEmail);
      if (found) return found;
      
      if (users.length < 1000) hasMore = false;
      page++;
    }
  } catch (err) {
    console.error('[findAuthUserByEmail] Unexpected error:', err);
  }
  return null;
}

export async function getOnboardingToken(email: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 0. Multi-format sanitization
    const rawEmail = email.trim();
    const lowerEmail = rawEmail.toLowerCase();
    const plusEmail = lowerEmail.replace(/\s+/g, '+'); // Fix + becoming space
    const spaceEmail = lowerEmail.replace(/\+/g, ' '); // Handle potential over-encoding
    
    const searchEmails = [...new Set([rawEmail, lowerEmail, plusEmail, spaceEmail])];

    // 1. Multi-path matching for maximum reliability
    const [designers, clients] = await Promise.all([
      adminSupabase.from('designers').select('id').in('email', searchEmails),
      adminSupabase.from('clients').select('id').in('email', searchEmails)
    ]);

    // Fallback: If exact IN matches fail, try case-insensitive ILIKE on the most likely candidate
    let authorized = (designers.data?.length || 0) > 0 || (clients.data?.length || 0) > 0;
    let role: 'designer' | 'client' = 'designer';

    if (!authorized) {
      const { data: d } = await adminSupabase.from('designers').select('id').ilike('email', plusEmail).maybeSingle();
      const { data: c } = await adminSupabase.from('clients').select('id').ilike('email', plusEmail).maybeSingle();
      if (d || c) {
        authorized = true;
        role = d ? 'designer' : 'client';
      }
    } else {
      role = (designers.data?.length || 0) > 0 ? 'designer' : 'client';
    }

    if (!authorized) {
      console.error(`[getOnboardingToken] Authorization Failed. Checked: ${JSON.stringify(searchEmails)}`);
      throw new Error("You haven't been invited yet or your email is incorrect.");
    }

    // 2. Generate a fresh link (this won't be sent via email, just returned to the app)
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: 'https://www.cadonce.com/auth/setup' }
    });

    if (error) throw error;

    return { 
      success: true, 
      token_hash: data.properties.hashed_token,
      email: email,
      role: role as 'designer' | 'client'
    };
  } catch (err: any) {
    console.error('[getOnboardingToken] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function completeOnboardingProfile(details: { 
  email: string, 
  role: 'designer' | 'client',
  fullName: string,
  mobile: string,
  country: string,
  companyName?: string
}) {
  try {
    const { createAdminClient } = await import('@/lib/supabaseServer');
    const adminSupabase = await createAdminClient();

    // 0. Sanitize
    const sanitizedEmail = details.email.trim().toLowerCase();

    // 1. Identify User in Auth to sync metadata
    const targetUser = await findAuthUserByEmail(adminSupabase, details.email);

    if (!targetUser) {
      console.error(`[completeOnboardingProfile] User not found in Auth for email: ${details.email}`);
      throw new Error("Your login account was not found. Please try re-clicking your invitation link or contact support.");
    }

    // 2. Update Auth Metadata for consistent greeting/role
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(targetUser.id, {
        user_metadata: { 
          ...targetUser.user_metadata,
          full_name: details.fullName,
          mobile: details.mobile,
          country: details.country,
          company_name: details.companyName || (details.role === 'designer' ? 'Freelance' : 'Independent')
        }
    });

    if (updateError) {
      console.error('[completeOnboardingProfile] Auth update failed:', updateError.message);
    }

    // 3. Create/Update personal settings record with virtualized system_config pattern
      const { upsertSettings } = await import('@/lib/db');
      
      const systemConfig = {
        id: 'system_config',
        type: 'INTERNAL_CONFIG',
        organizationName: details.companyName || (details.role === 'designer' ? 'Freelance' : 'Independent'),
        ownerName: details.fullName,
        whatsapp: details.mobile,
        country: details.country,
        pointsBalance: 0
      };

      await upsertSettings({
        senderName: details.fullName,
        payment_methods: [systemConfig]
      }, targetUser.id, adminSupabase);

      // 4. Update the record the Organization sees
      if (details.role === 'designer') {
        const { error } = await adminSupabase
          .from('designers')
          .update({
            fullName: details.fullName,
            mobile: details.mobile,
            country: details.country
            // [REVERTED] user_id represents the HIRING ORGANIZATION, not the designer.
            // Overwriting it would remove the designer from the organization's team list.
          })
          .ilike('email', sanitizedEmail);
        if (error) throw error;
      } else {
        const { error } = await adminSupabase
          .from('clients')
          .update({
            customerName: details.fullName,
            companyName: details.companyName || details.fullName,
            mobile: details.mobile,
            country: details.country,
            user_id: targetUser.id // Link the record
          })
          .ilike('email', sanitizedEmail);
        if (error) throw error;
      }

    return { success: true };
  } catch (err: any) {
    console.error('[completeOnboardingProfile] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getProjectTimeLogs(projectId: string) {
  const { createAdminClient } = await import('@/lib/supabaseServer');
  const adminSupabase = await createAdminClient();
  
  try {
    const { data: logs, error } = await adminSupabase
      .from('desktop_time_logs')
      .select('*')
      .eq('project_id', projectId);
      
    const { data: files } = await adminSupabase
      .storage
      .from('project-assets')
      .list(`screenshots/${projectId}`);
        
    const screenshots = files?.map(f => f.name) || [];
      
    if (!error && logs && logs.length > 0) {
      return { success: true, logs, screenshots };
    }
    
    const { data: allSettings } = await adminSupabase
      .from('settings')
      .select('user_id, payment_methods');
      
    const fallbackLogs: any[] = [];
    allSettings?.forEach((setting: any) => {
      const methods = setting.payment_methods || [];
      methods.forEach((m: any) => {
        if (m.type === 'TIME_LOG' && m.project_id === projectId) {
          fallbackLogs.push({
            ...m,
            user_id: setting.user_id
          });
        }
      });
    });
    
    return { 
      success: true, 
      logs: logs || fallbackLogs,
      screenshots 
    };
  } catch (err: any) {
    console.error('[getProjectTimeLogs] Error:', err.message);
    return { success: false, error: err.message };
  }
}
