import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import OpenAI from 'openai';
import { TEMPLATES, type Template } from '@/lib/templates';

const CTA_OPTIONS = new Set([
  'Ganhar seguidor',
  'Curtida (2 toques na tela)',
  'Repostar',
  'Compartilhar com amigo',
  'Salvar',
]);

interface Variation {
  gancho: string;
  abertura: string;
  desenvolvimento: string;
  cta: string;
}

function buildPrompt({ nicho, icp, template, cta }: { nicho: string; icp: string; template: Template; cta: string }) {
  const lines = [
    'Você é um estrategista de conteúdo especializado em ganchos de atenção para vídeos curtos (Reels, TikTok, Shorts), seguindo a metodologia dos "Templates da Atenção".',
    '',
    'NICHO DE ATUAÇÃO: ' + nicho,
    'ICP (PÚBLICO IDEAL COMPRADOR): ' + icp,
    '',
    'TEMPLATE ESCOLHIDO: "' + template.title + '"',
    'Exemplo original do gancho: "' + template.hook + '"',
    'Como o template funciona: ' + template.how,
    'Dica de aplicação: ' + template.tip,
    '',
    'OBJETIVO DO CTA: ' + cta,
    '',
    'Sua tarefa: gerar 3 variações de conteúdo, adaptando fielmente a ESTRUTURA do template acima para o nicho e o ICP informados. Cada variação deve ser diferente das outras (ângulos, exemplos ou dores diferentes dentro do mesmo nicho) e soar natural em português do Brasil, com tom direto e persuasivo, sem parecer robótico ou genérico.',
    '',
    'Para cada variação, gere:',
    '- "gancho": a frase de abertura do vídeo, seguindo a estrutura do template, adaptada ao nicho/ICP (1 frase forte, pronta pra falar em vídeo).',
    '- "abertura": 1-2 frases que vêm logo após o gancho para reforçá-lo e prender a atenção nos primeiros segundos.',
    '- "desenvolvimento": 2-4 frases que desenvolvem o conteúdo prometido no gancho, aplicando a lógica do template ao nicho/ICP.',
    '- "cta": 1 frase curta de fechamento que peça explicitamente a ação de "' + cta + '", de forma natural e coerente com o nicho (não use frases genéricas como "siga para mais dicas" — peça a ação específica).',
    '',
    'Responda APENAS com um JSON válido no formato exato:',
    '{"variations": [{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."},{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."},{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."}]}',
  ];
  return lines.join('\n');
}

function parseVariations(text: string): Variation[] {
  let cleaned = text.trim();
  const fence = '```';
  if (cleaned.startsWith(fence)) {
    cleaned = cleaned.slice(fence.length);
    if (cleaned.toLowerCase().startsWith('json')) cleaned = cleaned.slice(4);
  }
  if (cleaned.endsWith(fence)) cleaned = cleaned.slice(0, -fence.length);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);
  const list = parsed.variations || parsed;
  if (!Array.isArray(list) || list.length === 0) throw new Error('Formato inesperado');

  return list.slice(0, 3).map((v: any) => ({
    gancho: String(v.gancho ?? ''),
    abertura: String(v.abertura ?? ''),
    desenvolvimento: String(v.desenvolvimento ?? ''),
    cta: String(v.cta ?? ''),
  }));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { nicho, icp, templateId, cta } = body ?? {};

  if (typeof nicho !== 'string' || !nicho.trim()) {
    return NextResponse.json({ error: 'Nicho é obrigatório.' }, { status: 400 });
  }
  if (typeof icp !== 'string' || !icp.trim()) {
    return NextResponse.json({ error: 'ICP é obrigatório.' }, { status: 400 });
  }
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: 'Template inválido.' }, { status: 400 });
  }
  if (typeof cta !== 'string' || !CTA_OPTIONS.has(cta)) {
    return NextResponse.json({ error: 'CTA inválido.' }, { status: 400 });
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
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
  }

  const { data: keyData } = await supabase
    .from('user_openai_keys')
    .select('openai_api_key, plan, total_generations')
    .eq('id', user.id)
    .single();

  const plan = keyData?.plan || 'free';
  const totalGenerations = keyData?.total_generations || 0;

  // Enforce usage limits
  let limit = 3;
  let planName = 'Gratuito';
  if (plan === 'silver' || plan === 'plan_10') {
    limit = 10;
    planName = 'Bronze (10 usos)';
  } else if (plan === 'gold' || plan === 'plan_50') {
    limit = 50;
    planName = 'Prata (50 usos)';
  } else if (plan === 'unlimited' || plan === 'plan_unlimited' || plan === 'diamond') {
    limit = Infinity;
    planName = 'Ouro (Ilimitado)';
  }

  if (totalGenerations >= limit) {
    return NextResponse.json(
      { error: `Você atingiu o limite do seu plano ${planName} (${limit} gerações). Assine um plano premium nas configurações para continuar.` },
      { status: 403 }
    );
  }

  const apiKey = keyData?.openai_api_key?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da OpenAI não configurada. Cadastre sua API Key nas configurações.' },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: buildPrompt({ nicho: nicho.trim(), icp: icp.trim(), template, cta }) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Resposta sem texto.');

    const variations = parseVariations(text);

    // Salvar no histórico de gerações do usuário
    const { error: historyError } = await supabase
      .from('generation_history')
      .insert({
        user_id: user.id,
        nicho: nicho.trim(),
        icp: icp.trim(),
        template_id: templateId,
        cta: cta,
        variations: variations,
      });

    if (historyError) {
      console.error('Erro ao salvar histórico de geração:', historyError);
    }

    // Incrementar contagem de geração
    if (keyData) {
      await supabase
        .from('user_openai_keys')
        .update({ total_generations: totalGenerations + 1 })
        .eq('id', user.id);
    } else {
      await supabase
        .from('user_openai_keys')
        .insert({ id: user.id, plan: 'free', total_generations: 1 });
    }

    return NextResponse.json({ variations });
  } catch (err: any) {
    console.error('Erro ao gerar variações:', err);
    const isAuthError = err.status === 401 || err.message?.includes('Incorrect API key') || err.message?.includes('invalid_api_key');
    const msg = isAuthError
      ? 'A chave da OpenAI cadastrada no seu perfil é inválida ou sem permissão. Atualize sua chave nas configurações.'
      : (err instanceof Error ? err.message : 'A geração falhou ou veio em um formato inesperado. Tente novamente.');
    return NextResponse.json(
      { error: msg },
      { status: isAuthError ? 401 : 502 },
    );
  }
}
