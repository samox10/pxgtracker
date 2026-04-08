import { createClient } from '@supabase/supabase-js';

// Aqui o Next.js vai buscar as chaves secretas que você colocou no .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Criamos a nossa "ponte de comunicação"
export const supabase = createClient(supabaseUrl, supabaseKey);