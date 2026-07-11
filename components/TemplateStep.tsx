'use client';

import { TEMPLATES } from '@/lib/templates';

interface TemplateStepProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTemplateId: number | null;
  onSelectTemplate: (id: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function TemplateStep({
  search,
  onSearchChange,
  selectedTemplateId,
  onSelectTemplate,
  onBack,
  onContinue,
}: TemplateStepProps) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? TEMPLATES.filter((t) => t.title.toLowerCase().includes(q) || t.hook.toLowerCase().includes(q))
    : TEMPLATES;

  return (
    <div className="step step-wide">
      <div className="step-label">Passo 3 de 3</div>
      <h2>Escolha um template de gancho</h2>
      <p className="step-desc">30 estruturas validadas do ebook. Clique em uma para selecioná-la.</p>

      <input
        type="text"
        className="field"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar por palavra-chave... (ex: comparação, alerta, autoridade)"
      />

      <div className="template-grid">
        {filtered.map((tpl) => {
          const selected = tpl.id === selectedTemplateId;
          return (
            <div
              key={tpl.id}
              className={'template-card' + (selected ? ' selected' : '')}
              onClick={() => onSelectTemplate(tpl.id)}
            >
              <div className="template-card-top">
                <span className="template-number">{String(tpl.id).padStart(2, '0')}</span>
                {selected && <span className="selected-badge">Selecionado</span>}
              </div>
              <div className="template-title">{tpl.title}</div>
              <div className="template-hook">&quot;{tpl.hook}&quot;</div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="no-results">Nenhum template encontrado para &quot;{search}&quot;.</div>
      )}

      <div className="actions-row actions-row-wide">
        <button className="btn-secondary" onClick={onBack}>Voltar</button>
        <button
          className={'btn-primary' + (selectedTemplateId === null ? ' disabled' : '')}
          disabled={selectedTemplateId === null}
          onClick={() => selectedTemplateId !== null && onContinue()}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
