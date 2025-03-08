import { supabase, RestrictedItem } from '@/lib/supabase';

export async function getRestrictedItems(): Promise<RestrictedItem[]> {
    const { data, error } = await supabase
        .from('restricted_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching restricted items:', error);
        throw error;
    }

    return data || [];
}

export async function createRestrictedItem(item: Omit<RestrictedItem, 'id' | 'created_at' | 'updated_at'>): Promise<RestrictedItem> {
    const { data, error } = await supabase
        .from('restricted_items')
        .insert([item])
        .select()
        .single();

    if (error) {
        console.error('Error creating restricted item:', error);
        throw error;
    }

    return data;
}