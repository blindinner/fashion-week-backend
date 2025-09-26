import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Debug: Log all environment variables
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('All env vars starting with SUPABASE:', Object.keys(process.env).filter(key => key.startsWith('SUPABASE')));
console.log('=====================================');

const supabaseUrl = process.env.SUPABASE_URL || 'https://hjolnklxcuxacpnicrai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('Available environment variables:', Object.keys(process.env));
    throw new Error('Missing Supabase key. Please set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in your environment variables.');
}

// Create Supabase client with service role key for admin operations
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default supabase;

