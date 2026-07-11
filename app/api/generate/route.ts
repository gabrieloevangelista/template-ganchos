import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TEMPLATES, type Template } from '@/lib/templates';

const anthropic = new Anthropic();

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
    'Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:',
    '[{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."},{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."},{"gancho":"...","abertura":"...","desenvolvimento":"...","cta":"..."}]',
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

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start >= 0 && end >= 0) cleaned = cleaned.slice(start, end + 1);

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Formato inesperado');

  return parsed.slice(0, 3).map((v) => ({
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

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: buildPrompt({ nicho: nicho.trim(), icp: icp.trim(), template, cta }) },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('Resposta sem texto.');

    const variations = parseVariations(textBlock.text);
    return NextResponse.json({ variations });
  } catch (err) {
    console.error('Erro ao gerar variações:', err);
    return NextResponse.json(
      { error: 'A geração falhou ou veio em um formato inesperado. Tente novamente — geralmente funciona na segunda tentativa.' },
      { status: 502 },
    );
  }
}
