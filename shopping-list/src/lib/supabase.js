import { createClient } from '@supabase/supabase-js';

// Supabase publishable keys and project URLs are designed for use in public
// clients. RLS is the security boundary; never put a service_role key here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zwneawgtcrlgjehwryfb.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ScSeKSb1Pn5uQibRoVJOWA_BBxZstAO';
export const isConfigured = Boolean(supabaseUrl && publishableKey);
export const supabase = isConfigured ? createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
}) : null;
export const powerSyncUrl = import.meta.env.VITE_POWERSYNC_URL || 'https://6aefe323e277c04a3d8eb189.powersync.journeyapps.com';
