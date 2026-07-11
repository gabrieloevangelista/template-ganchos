'use client';

import { useState } from 'react';
import { TEMPLATES } from '@/lib/templates';
import TemplateStep from '@/components/TemplateStep';

const CTA_OPTIONS = ['Ganhar seguidor', 'Curtida (2 toques na tela)', 'Repostar', 'Compartilhar com amigo', 'Salvar'];
const STEP_INDEX: Record<string, number> = { nicho: 0, icp: 1, template: 2, cta: 3, loading: 3, error: 3, results: 4 };
const STEP_COUNT = 5;

type Step = 'intro' | 'nicho' | 'icp' | 'template' | 'cta' | 'loading' | 'error' | 'results';

interface Variation {
  gancho: string;
  abertura: string;
  desenvolvimento: string;
  cta: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>('intro');
  const [nicho, setNicho] = useState('');
  const [icp, setIcp] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedCta, setSelectedCta] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;
  const curIdx = STEP_INDEX[step];

  async function generate() {
    setStep('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicho, icp, templateId: selectedTemplateId, cta: selectedCta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na geração.');
      setVariations(data.variations);
      setCopiedIndex(null);
      setStep('results');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'A geração falhou ou veio em um formato inesperado. Tente novamente — geralmente funciona na segunda tentativa.',
      );
      setStep('error');
    }
  }

  function copyVariation(i: number) {
    if (!variations) return;
    const v = variations[i];
    const text = [v.gancho, v.abertura, v.desenvolvimento, v.cta].join('\n\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex((cur) => (cur === i ? null : cur)), 1600);
  }

  return (
    <div id="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <span className="brand-name">Gerador de Ganchos</span>
        </div>
        {step !== 'intro' && (
          <div className="step-dots">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div key={i} className={'dot' + (curIdx !== undefined && i <= curIdx ? ' active' : '')} />
            ))}
          </div>
        )}
      </div>

      {step === 'intro' && (
        <div className="intro">
          <div className="badge">30 Templates da Atenção</div>
          <h1>
            Transforme qualquer template
            <br />
            em conteúdo pronto pro seu nicho
          </h1>
          <p>
            Conte seu nicho, descreva seu público ideal, escolha um dos 30 ganchos validados do ebook — e receba 3
            variações de conteúdo prontas para gravar.
          </p>
          <button className="btn-primary btn-lg" onClick={() => setStep('nicho')}>
            Começar →
          </button>
        </div>
      )}

      {step === 'nicho' && (
        <div className="step step-narrow">
          <div className="step-label">Passo 1 de 3</div>
          <h2>Qual o seu nicho de atuação?</h2>
          <p className="step-desc">Seja específico — isso ajuda a adaptar os exemplos do template para a sua realidade.</p>
          <input
            type="text"
            className="field"
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            placeholder="Ex: nutrição esportiva, direito trabalhista, estética facial..."
            autoFocus
          />
          <div className="actions-row">
            <button className="btn-secondary" onClick={() => setStep('intro')}>
              Voltar
            </button>
            <button
              className={'btn-primary' + (nicho.trim() ? '' : ' disabled')}
              disabled={!nicho.trim()}
              onClick={() => nicho.trim() && setStep('icp')}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {step === 'icp' && (
        <div className="step step-narrow">
          <div className="step-label">Passo 2 de 3</div>
          <h2>Quem é o seu ICP?</h2>
          <p className="step-desc">
            Descreva o público ideal comprador: idade, dores, desejos, objeções. Quanto mais detalhe, mais preciso o
            gancho.
          </p>
          <textarea
            className="field"
            rows={5}
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            placeholder="Ex: mulheres de 35-50 anos, na menopausa, frustradas por não conseguir emagrecer mesmo se exercitando, já tentaram várias dietas..."
            autoFocus
          />
          <div className="actions-row">
            <button className="btn-secondary" onClick={() => setStep('nicho')}>
              Voltar
            </button>
            <button
              className={'btn-primary' + (icp.trim() ? '' : ' disabled')}
              disabled={!icp.trim()}
              onClick={() => icp.trim() && setStep('template')}
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {step === 'template' && (
        <TemplateStep
          search={search}
          onSearchChange={setSearch}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={setSelectedTemplateId}
          onBack={() => setStep('icp')}
          onContinue={() => setStep('cta')}
        />
      )}

      {step === 'cta' && (
        <div className="step step-narrow">
          <div className="step-label">Passo 4 de 4</div>
          <h2>Qual o objetivo do CTA?</h2>
          <p className="step-desc">O fechamento de cada variação vai empurrar o espectador para essa ação.</p>
          <div className="cta-list">
            {CTA_OPTIONS.map((label) => {
              const selected = selectedCta === label;
              return (
                <div
                  key={label}
                  className={'cta-option' + (selected ? ' selected' : '')}
                  onClick={() => setSelectedCta(label)}
                >
                  <span className="cta-label">{label}</span>
                  {selected && <span className="selected-badge">Selecionado</span>}
                </div>
              );
            })}
          </div>
          <div className="actions-row">
            <button className="btn-secondary" onClick={() => setStep('template')}>
              Voltar
            </button>
            <button
              className={'btn-primary' + (selectedCta === null ? ' disabled' : '')}
              disabled={selectedCta === null}
              onClick={() => selectedCta !== null && generate()}
            >
              Gerar 3 variações →
            </button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="loading-wrap">
          <div className="spinner" />
          <div className="loading-title">Criando variações para o seu nicho...</div>
          <div className="loading-sub">Aplicando o template &quot;{selectedTemplate?.title ?? ''}&quot;</div>
        </div>
      )}

      {step === 'error' && (
        <div className="error-wrap">
          <div className="error-title">Não deu para gerar agora</div>
          <div className="error-msg">{errorMsg}</div>
          <button className="btn-primary" onClick={() => generate()}>
            Tentar de novo
          </button>
        </div>
      )}

      {step === 'results' && variations && (
        <div className="results">
          <div className="results-header">
            <div>
              <div className="results-label">
                Template {selectedTemplate ? String(selectedTemplate.id).padStart(2, '0') : ''} ·{' '}
                {selectedTemplate?.title ?? ''}
              </div>
              <h2>3 variações para {nicho}</h2>
            </div>
            <div className="results-actions">
              <button className="btn-ghost" onClick={() => setStep('template')}>
                ← Trocar template
              </button>
              <button className="btn-gold-ghost" onClick={() => generate()}>
                ↻ Gerar 3 novas
              </button>
            </div>
          </div>

          <div className="results-grid">
            {variations.map((v, i) => (
              <div className="result-card" key={i}>
                <div className="result-card-top">
                  <span className="result-index">Variação {i + 1}</span>
                  <button className={'btn-copy' + (copiedIndex === i ? ' copied' : '')} onClick={() => copyVariation(i)}>
                    {copiedIndex === i ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
                <div className="result-gancho">&quot;{v.gancho}&quot;</div>
                <div className="divider" />
                <div>
                  <div className="result-label">Abertura</div>
                  <div className="result-text">{v.abertura}</div>
                </div>
                <div>
                  <div className="result-label">Desenvolvimento</div>
                  <div className="result-text">{v.desenvolvimento}</div>
                </div>
                <div>
                  <div className="result-label">CTA</div>
                  <div className="result-text">{v.cta}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="results-footer">
            Nicho: {nicho} · ICP: {icp.length > 80 ? icp.slice(0, 80) + '…' : icp}
          </div>
        </div>
      )}
    </div>
  );
}
