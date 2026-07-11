import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa cliente direto com anon para rodar RPC
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Corpo vazio.' }, { status: 400 });
    }

    // Evento de checkout finalizado
    if (body.event === 'checkout.completed') {
      const checkout = body.data;
      const metadata = checkout?.metadata;
      const userId = metadata?.userId;
      const planId = metadata?.planId;

      if (!userId || !planId) {
        return NextResponse.json({ error: 'Metadata ausente no checkout.' }, { status: 400 });
      }

      if (planId === 'extra_50') {
        // Adiciona 50 créditos ao saldo do usuário
        const { data, error } = await supabase.rpc('add_additional_credits', {
          user_id: userId,
          credits_to_add: 50,
          secret_token: 'abacatepay_webhook_secret_token_2026'
        });

        if (error || !data) {
          console.error('Erro ao adicionar créditos via RPC:', error);
          return NextResponse.json({ error: 'Erro ao creditar saldo.' }, { status: 500 });
        }

        console.log(`[AbacatePay Webhook] 50 créditos adicionados com sucesso para ${userId}`);
      } else {
        // Executa a função RPC segura no Supabase que ignora RLS usando a chave secreta
        const { data, error } = await supabase.rpc('update_user_plan_secure', {
          user_id: userId,
          new_plan: planId,
          secret_token: 'abacatepay_webhook_secret_token_2026'
        });

        if (error || !data) {
          console.error('Erro ao atualizar plano no Supabase via RPC:', error);
          return NextResponse.json({ error: 'Erro ao aplicar plano.' }, { status: 500 });
        }

        console.log(`[AbacatePay Webhook] Plano ${planId} ativado com sucesso para o usuário ${userId}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro no processamento do webhook AbacatePay:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
