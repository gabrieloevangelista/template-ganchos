import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Retorna um cliente mockado para evitar falha no build estático da Vercel se as variáveis de ambiente estiverem ausentes no build
    return {
      auth: {
        getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => {},
        signUp: async () => ({ data: { user: null }, error: new Error('As variáveis de ambiente do Supabase não foram carregadas no cliente. Por favor, reinicie o servidor de desenvolvimento ou configure-as na Vercel.') }),
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('As variáveis de ambiente do Supabase não foram carregadas no cliente. Por favor, reinicie o servidor de desenvolvimento ou configure-as na Vercel.') }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
        delete: () => ({ eq: () => {} }),
      })
    } as any;
  }

  return createBrowserClient(url, anonKey);
};
