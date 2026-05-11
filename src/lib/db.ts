import { supabase as browserClient } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * All database calls now require a userId to ensure data isolation.
 */

export interface Database {
  projects: any[];
  designers: any[];
  clients: any[];
  settings: any;
  products: any[];
}

const defaultDb: Database = {
  projects: [],
  designers: [],
  clients: [],
  settings: {},
  products: []
};

/**
 * Reads the entire database for a specific user
 */
export async function readDb(userId: string, customClient?: SupabaseClient): Promise<Database> {
  if (!userId) return defaultDb;

  const supabase = customClient || browserClient;

  try {
    const [projects, designers, clients, settings, products] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', userId).order('createdAt', { ascending: false }),
      supabase.from('designers').select('*').eq('user_id', userId).order('createdAt', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', userId).order('createdAt', { ascending: false }),
      supabase.from('settings').select('*').eq('user_id', userId).limit(1),
      supabase.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    if (projects.error) console.error('Projects fetch error:', projects.error);
    if (designers.error) console.error('Designers fetch error:', designers.error);
    if (clients.error) console.error('Clients fetch error:', clients.error);
    if (settings.error) console.error('Settings fetch error:', settings.error);
    if (products.error) console.error('Products fetch error:', products.error);

    return {
      projects: projects.data || [],
      designers: designers.data || [],
      clients: clients.data || [],
      settings: settings.data?.[0] || {},
      products: products.data || [],
    };
  } catch (error) {
    console.error('Unexpected error in readDb:', error);
    return defaultDb;
  }
}

/**
 * Insert a new record tied to a specific user
 */
export async function insertRecord(table: string, data: any, userId: string, customClient?: SupabaseClient) {
  if (!userId) throw new Error('Authentication required');
  const supabase = customClient || browserClient;
  const { error } = await supabase.from(table).insert({ ...data, user_id: userId });
  if (error) throw new Error(`Insert failed: ${error.message}`);
}

/**
 * Update a record by id (isolation handled by eq('user_id'))
 */
export async function updateRecord(table: string, id: string, data: any, userId: string, customClient?: SupabaseClient) {
  if (!userId) throw new Error('Authentication required');
  const supabase = customClient || browserClient;
  const { error } = await supabase.from(table).update(data).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Update failed: ${error.message}`);
}

/**
 * Delete a record by id
 */
export async function deleteRecord(table: string, id: string, userId: string, customClient?: SupabaseClient) {
  if (!userId) throw new Error('Authentication required');
  const supabase = customClient || browserClient;
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export async function upsertSettings(data: any, userId: string, customClient?: SupabaseClient) {
  if (!userId) throw new Error('Authentication required');
  const supabase = customClient || browserClient;
  
  // 1. Check for existing record
  const { data: records } = await supabase
    .from('settings')
    .select('id')
    .eq('user_id', userId);

  if (records && records.length > 0) {
    // 2. Update existing
    const { error } = await supabase.from('settings').update(data).eq('user_id', userId);
    if (error) throw new Error(`Settings update failed: ${error.message}`);
  } else {
    // 3. Insert new with manual ID increment (Fallback for non-serial PK)
    const { data: maxRow } = await supabase
      .from('settings')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    
    const nextId = (maxRow?.[0]?.id || 0) + 1;
    
    const { error } = await supabase.from('settings').insert({ 
      ...data, 
      id: nextId,
      user_id: userId 
    });
    if (error) throw new Error(`Settings insert failed: ${error.message}`);
  }
}
