import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definition for our table
export type RestrictedItem = {
    id: string;
    name: string;
    status: string;
    details: Record<string, any>;
    source_url?: string;
    created_at: string;
    updated_at: string;
};