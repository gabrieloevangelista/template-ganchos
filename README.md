# Gerador de Ganchos

Wizard (nicho → ICP → template de gancho → CTA) que gera 3 variações de conteúdo
via API da Anthropic, seguindo os 30 "Templates da Atenção". Next.js (App Router),
pronto para deploy na Vercel.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # edite e adicione sua ANTHROPIC_API_KEY
npm run dev
```

Abra http://localhost:3000.

## Deploy na Vercel

1. Suba este diretório (`web/`) como a raiz do projeto na Vercel — se o repositório
   tiver mais pastas na raiz, configure "Root Directory" = `web` nas configurações
   do projeto.
2. Defina a variável de ambiente `ANTHROPIC_API_KEY` em Project Settings →
   Environment Variables (não é necessário nenhum outro segredo).
3. Deploy — o build padrão do Next.js (`next build`) já funciona sem configuração
   adicional.

## Estrutura

- `app/page.tsx` — o wizard (client component), com um `useState` por campo de
  estado e renderização condicional por etapa.
- `components/TemplateStep.tsx` — a etapa de escolha de template (busca + grid),
  separada por ter lógica de filtro própria.
- `app/api/generate/route.ts` — Route Handler que valida a requisição, monta o
  mesmo prompt usado no protótipo e chama a API da Anthropic (`claude-opus-4-8`)
  no servidor — a chave de API nunca chega ao navegador.
- `lib/templates.ts` — os 30 templates (usado tanto pela UI quanto pela rota de
  API).
- `app/globals.css` — o visual (dark, dourado, Space Grotesk + Manrope).
