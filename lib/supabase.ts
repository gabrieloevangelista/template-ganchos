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
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }),
        delete: () => ({ eq: () => {} }),
      })
    } as any;
  }

  return createBrowserClient(url, anonKey);
};
