import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jzzyfpcqeskedsxaiqtu.supabase.co';
const supabaseAnonKey = 'sb_publishable_0nmZ4CYM4EMqCHosEqDIWw_GZuUqMY-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);