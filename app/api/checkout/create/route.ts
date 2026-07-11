import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { planId } = body ?? {};

  const plans: Record<string, { name: string; price: number }> = {
    plan_10: { name: 'Plano Bronze', price: 1990 },
    plan_50: { name: 'Plano Prata', price: 3990 },
    plan_unlimited: { name: 'Plano Ouro', price: 4990 }
  };

  const planInfo = plans[planId];
  if (!planInfo) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const abacatepayKey = process.env.ABACATEPAY_API_KEY;
  if (!abacatepayKey) {
    return NextResponse.json({ error: 'Integração AbacatePay não configurada no servidor.' }, { status: 500 });
  }

  try {
    let productId = '';
    
    // 1. Tenta criar o produto no AbacatePay
    const productRes = await fetch('https://api.abacatepay.com/v2/products/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abacatepayKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        externalId: planId,
        name: planInfo.name,
        price: planInfo.price,
        currency: 'BRL'
      })
    });

    const productData = await productRes.json();
    if (productData.success && productData.data?.id) {
      productId = productData.data.id;
    } else {
      // Se já existir ou der erro, busca o produto cadastrado na lista
      const listRes = await fetch('https://api.abacatepay.com/v2/products/list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${abacatepayKey}`
        }
      });
      const listData = await listRes.json();
      if (listData.success && Array.isArray(listData.data)) {
        const existing = listData.data.find((p: any) => p.externalId === planId);
        if (existing) {
          productId = existing.id;
        }
      }
    }

    if (!productId) {
      throw new Error('Não foi possível registrar ou encontrar o produto no AbacatePay.');
    }

    // 2. Cria a sessão de checkout
    const checkoutRes = await fetch('https://api.abacatepay.com/v2/checkouts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abacatepayKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            id: productId,
            quantity: 1
          }
        ],
        methods: ["PIX", "CARD"],
        returnUrl: `${req.headers.get('origin') || 'http://localhost:3000'}/`,
        completionUrl: `${req.headers.get('origin') || 'http://localhost:3000'}/`,
        metadata: {
          userId: user.id,
          planId: planId
        }
      })
    });

    const checkoutData = await checkoutRes.json();
    if (!checkoutData.success || !checkoutData.data?.url) {
      throw new Error(checkoutData.error || 'Falha ao criar sessão de checkout no AbacatePay.');
    }

    return NextResponse.json({ url: checkoutData.data.url });
  } catch (err: any) {
    console.error('Erro no checkout:', err);
    return NextResponse.json({ error: err.message || 'Erro ao processar pagamento.' }, { status: 500 });
  }
}
