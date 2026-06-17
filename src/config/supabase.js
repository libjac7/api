import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL; //url de supabase
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY; //admin key para permisos de admin

// instancia con permisos de admin
export const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});