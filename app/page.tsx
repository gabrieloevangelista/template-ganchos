'use client';

import { useState, useEffect } from 'react';
import { TEMPLATES } from '@/lib/templates';
import TemplateStep from '@/components/TemplateStep';
import { createClient } from '@/lib/supabase';

const CTA_OPTIONS = ['Ganhar seguidor', 'Curtida (2 toques na tela)', 'Repostar', 'Compartilhar com amigo', 'Salvar'];
const STEP_INDEX: Record<string, number> = { nicho: 0, icp: 1, template: 2, cta: 3, loading: 3, error: 3, results: 4 };
const STEP_COUNT = 5;

type Step = 'intro' | 'login' | 'nicho' | 'icp' | 'template' | 'cta' | 'loading' | 'error' | 'results' | 'history';

interface Variation {
  gancho: string;
  abertura: string;
  desenvolvimento: string;
  cta: string;
}

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>('intro');
  const [nicho, setNicho] = useState('');
  const [icp, setIcp] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedCta, setSelectedCta] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Supabase Auth and OpenAI State
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [openaiKey, setOpenaiKey] = useState('');
  const [tempOpenaiKey, setTempOpenaiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [userPlan, setUserPlan] = useState('free');
  const [totalGenerations, setTotalGenerations] = useState(0);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then((res: any) => {
      const user = res.data?.user;
      setUser(user);
      if (user) {
        loadUserKey(user.id);
      } else {
        setLoadingUser(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const hasKey = await loadUserKey(currentUser.id);
        if (event === 'SIGNED_IN') {
          setStep(hasKey ? 'nicho' : 'login');
        }
      } else {
        setOpenaiKey('');
        setTempOpenaiKey('');
        setLoadingUser(false);
        setStep('intro');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserKey(userId: string): Promise<boolean> {
    setLoadingUser(true);
    try {
      const { data, error } = await supabase
        .from('user_openai_keys')
        .select('openai_api_key, plan, total_generations')
        .eq('id', userId)
        .single();
      if (data) {
        setOpenaiKey(data.openai_api_key || '');
        setTempOpenaiKey(data.openai_api_key || '');
        setUserPlan(data.plan || 'free');
        setTotalGenerations(data.total_generations || 0);
        return true;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUser(false);
    }
    return false;
  }

  async function loadHistory() {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('generation_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('Erro ao buscar histórico:', e);
    } finally {
      setLoadingHistory(false);
    }
  }

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;
  const curIdx = STEP_INDEX[step];

  async function generate() {
    setStep('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nicho, icp, templateId: selectedTemplateId, cta: selectedCta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na geração.');
      setVariations(data.variations);
      setCopiedIndex(null);
      setStep('results');
      setTotalGenerations((prev) => prev + 1);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'A geração falhou ou veio em um formato inesperado. Tente novamente — geralmente funciona na segunda tentativa.',
      );
      setStep('error');
    }
  }

  async function handleAuthSubmit() {
    if (!authEmail.trim() || authPassword.length < 6) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authTab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        alert('Cadastro realizado com sucesso! Se configurado, confirme seu e-mail ou faça login.');
        setAuthTab('login');
      }
    } catch (err: any) {
      let msg = err.message || 'Erro na autenticação.';
      if (msg === 'Invalid login credentials') {
        msg = 'E-mail ou senha incorretos. Verifique suas credenciais ou crie uma conta.';
      } else if (msg === 'User already registered') {
        msg = 'Este endereço de e-mail já está em uso.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Por favor, confirme seu endereço de e-mail antes de fazer login.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }



  async function handleSaveKey() {
    if (!user) return;
    setSavingKey(true);
    setKeyError('');
    try {
      const key = tempOpenaiKey.trim();
      const { error } = await supabase
        .from('user_openai_keys')
        .upsert({
          id: user.id,
          openai_api_key: key || null,
          plan: userPlan || 'free',
          total_generations: totalGenerations || 0
        });

      if (error) throw error;
      setOpenaiKey(key);
      alert('Chave salva com sucesso!');
    } catch (err: any) {
      setKeyError(err.message || 'Erro ao salvar a chave.');
    } finally {
      setSavingKey(false);
    }
  }

  async function handleDisconnect() {
    await supabase.auth.signOut();
    setUser(null);
    setOpenaiKey('');
    setTempOpenaiKey('');
    setStep('intro');
  }

  async function handleSubscribe(planId: string) {
    if (!user) return;
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar sessão de checkout.');

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Nenhum link de pagamento retornado.');
      }
    } catch (e: any) {
      console.error('Erro ao assinar plano:', e);
      alert(e.message || 'Erro ao iniciar pagamento com AbacatePay.');
    }
  }

  async function deleteHistoryItem(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta geração do seu histórico?')) return;
    try {
      const { error } = await supabase
        .from('generation_history')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setHistory((curr) => curr.filter((item) => item.id !== id));
    } catch (e) {
      console.error('Erro ao deletar histórico:', e);
      alert('Erro ao excluir histórico.');
    }
  }

  async function clearAllHistory() {
    if (!confirm('Tem certeza que deseja excluir todo o histórico de gerações? Esta ação não pode ser desfeita e liberará memória.')) return;
    try {
      const { error } = await supabase
        .from('generation_history')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      setHistory([]);
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
      alert('Erro ao limpar histórico.');
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

        {user && (
          <div className="api-badge" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            background: 'rgba(215, 161, 60, 0.05)',
            border: '1px solid rgba(215, 161, 60, 0.15)',
            padding: '4px 10px',
            borderRadius: '20px',
            color: '#f3ece0'
          }}>
            <span style={{ color: '#4caf50', fontSize: '0.6rem' }}>●</span>
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email}>{user.email}</span>
            <button 
              onClick={() => { setStep('history'); loadHistory(); }} 
              style={{
                background: 'none',
                border: 'none',
                color: '#d4af37',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              Histórico
            </button>
            <button 
              onClick={() => setStep('login')} 
              style={{
                background: 'none',
                border: 'none',
                color: '#d4af37',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
              title="Configurações & Planos"
            >
              Configurações
            </button>
            <button 
              onClick={handleDisconnect} 
              style={{
                background: 'none',
                border: 'none',
                color: '#a5731f',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              Sair
            </button>
          </div>
        )}

        {step !== 'intro' && step !== 'login' && step !== 'history' && (
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
          <button className="btn-primary btn-lg" onClick={() => setStep(user ? (openaiKey ? 'nicho' : 'login') : 'login')}>
            Começar →
          </button>
        </div>
      )}

      {step === 'login' && !user && (
        <div className="premium-card">
          <div className="step-label">Acesso ao Sistema</div>
          <h2>{authTab === 'login' ? 'Entrar no Gerador' : 'Criar sua Conta'}</h2>
          <p className="step-desc" style={{ marginBottom: '15px' }}>
            {authTab === 'login' 
              ? 'Faça login com seu e-mail e senha para usar seus créditos OpenAI.' 
              : 'Registre-se gratuitamente para começar a gerar seus roteiros.'}
          </p>
          
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid rgba(215, 161, 60, 0.1)' }}>
            <button 
              onClick={() => { setAuthTab('login'); setAuthError(''); }}
              className={`premium-tab-btn ${authTab === 'login' ? 'active' : ''}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => { setAuthTab('signup'); setAuthError(''); }}
              className={`premium-tab-btn ${authTab === 'signup' ? 'active' : ''}`}
            >
              Criar conta
            </button>
          </div>

          {authError && (
            <div style={{ color: '#ff4444', marginBottom: '15px', fontSize: '0.85rem', background: 'rgba(255, 68, 68, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
              {authError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email"
              className="field"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Endereço de e-mail"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && authEmail.trim() && authPassword.length >= 6) {
                  handleAuthSubmit();
                }
              }}
              autoFocus
            />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="field"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Sua senha (mínimo 6 caracteres)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && authEmail.trim() && authPassword.length >= 6) {
                    handleAuthSubmit();
                  }
                }}
                style={{ paddingRight: '75px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6b6152',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  padding: 0
                }}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="actions-row" style={{ marginTop: '24px' }}>
            <button className="btn-secondary" onClick={() => setStep('intro')}>
              Voltar
            </button>
            <button
              className={'btn-primary' + (authEmail.trim() && authPassword.length >= 6 && !authLoading ? '' : ' disabled')}
              disabled={!authEmail.trim() || authPassword.length < 6 || authLoading}
              onClick={handleAuthSubmit}
            >
              {authLoading ? 'Processando...' : (authTab === 'login' ? 'Entrar' : 'Cadastrar')}
            </button>
          </div>


        </div>
      )}

      {step === 'login' && user && (
        <div className="premium-card" style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="step-label">Configurações & Planos</div>
            <button className="btn-secondary btn-sm" onClick={() => setStep('nicho')}>
              Voltar
            </button>
          </div>

          {/* Section 1: OpenAI Key */}
          <div style={{ marginBottom: '30px', paddingBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ color: '#f3ece0', marginBottom: '10px', fontSize: '1.1rem' }}>Conectar OpenAI API Key</h3>
            <p className="step-desc" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>
              Insira sua chave de API para usar seus próprios créditos. Se deixar em branco, usará a chave padrão do sistema.
            </p>
            {keyError && (
              <div style={{ color: '#ff4444', marginBottom: '15px', fontSize: '0.85rem', background: 'rgba(255, 68, 68, 0.08)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                {keyError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="password"
                className="field"
                value={tempOpenaiKey}
                onChange={(e) => setTempOpenaiKey(e.target.value)}
                placeholder="sk-... (Opcional - Chave Própria)"
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleSaveKey} disabled={savingKey}>
                {savingKey ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            <div className="help-text" style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
              Precisa de uma chave? Crie em{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="help-link">
                OpenAI API Keys
              </a>
            </div>
          </div>

          {/* Section 2: Active Plan & Stats */}
          <div style={{ marginBottom: '30px', paddingBottom: '25px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ color: '#f3ece0', marginBottom: '10px', fontSize: '1.1rem' }}>Assinatura Atual</h3>
            <div style={{
              background: 'rgba(215, 161, 60, 0.04)',
              border: '1px solid rgba(215, 161, 60, 0.1)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: '#a89a86' }}>Plano Ativo:</span>
                <strong style={{
                  color: '#d7a13c',
                  textTransform: 'uppercase',
                  fontSize: '0.95rem',
                  letterSpacing: '0.05em'
                }}>
                  {userPlan === 'plan_10' ? 'Bronze (10 usos)' : userPlan === 'plan_50' ? 'Prata (50 usos)' : userPlan === 'plan_unlimited' ? 'Ouro (Ilimitado)' : 'Gratuito (3 usos)'}
                </strong>
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#8f8370', marginBottom: '6px' }}>
                  <span>Uso Consumido</span>
                  <span>
                    {totalGenerations} / {userPlan === 'plan_10' ? '10' : userPlan === 'plan_50' ? '50' : userPlan === 'plan_unlimited' ? '∞' : '3'} gerações
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${userPlan === 'plan_unlimited' ? 0 : Math.min(100, (totalGenerations / (userPlan === 'plan_10' ? 10 : userPlan === 'plan_50' ? 50 : 3)) * 100)}%`,
                    height: '100%',
                    background: '#d7a13c',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Upgrade plans */}
          <div>
            <h3 style={{ color: '#f3ece0', marginBottom: '15px', fontSize: '1.1rem' }}>Fazer Upgrade</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              
              {/* Bronze */}
              <div style={{
                background: userPlan === 'plan_10' ? 'rgba(215, 161, 60, 0.06)' : 'rgba(22, 19, 15, 0.3)',
                border: userPlan === 'plan_10' ? '2px solid #d7a13c' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '180px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f3ece0' }}>Bronze</h4>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#d7a13c', margin: '6px 0 4px' }}>R$ 19,90<span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#8f8370' }}>/mês</span></div>
                  <ul style={{ paddingLeft: '14px', margin: 0, fontSize: '0.75rem', color: '#a89a86', listStyleType: 'circle' }}>
                    <li>10 gerações</li>
                    <li>Fins comerciais</li>
                  </ul>
                </div>
                <button
                  className="btn-primary btn-sm"
                  style={{ width: '100%', padding: '8px', marginTop: '10px' }}
                  onClick={() => handleSubscribe('plan_10')}
                  disabled={userPlan === 'plan_10'}
                >
                  {userPlan === 'plan_10' ? 'Ativo' : 'Assinar'}
                </button>
              </div>

              {/* Prata */}
              <div style={{
                background: userPlan === 'plan_50' ? 'rgba(215, 161, 60, 0.06)' : 'rgba(22, 19, 15, 0.3)',
                border: userPlan === 'plan_50' ? '2px solid #d7a13c' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '180px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f3ece0' }}>Prata</h4>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#d7a13c', margin: '6px 0 4px' }}>R$ 39,90<span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#8f8370' }}>/mês</span></div>
                  <ul style={{ paddingLeft: '14px', margin: 0, fontSize: '0.75rem', color: '#a89a86', listStyleType: 'circle' }}>
                    <li>50 gerações</li>
                    <li>Fins comerciais</li>
                  </ul>
                </div>
                <button
                  className="btn-primary btn-sm"
                  style={{ width: '100%', padding: '8px', marginTop: '10px' }}
                  onClick={() => handleSubscribe('plan_50')}
                  disabled={userPlan === 'plan_50'}
                >
                  {userPlan === 'plan_50' ? 'Ativo' : 'Assinar'}
                </button>
              </div>

              {/* Ouro */}
              <div style={{
                background: userPlan === 'plan_unlimited' ? 'rgba(215, 161, 60, 0.06)' : 'rgba(22, 19, 15, 0.3)',
                border: userPlan === 'plan_unlimited' ? '2px solid #d7a13c' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '180px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f3ece0' }}>Ouro</h4>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#d7a13c', margin: '6px 0 4px' }}>R$ 49,90<span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#8f8370' }}>/mês</span></div>
                  <ul style={{ paddingLeft: '14px', margin: 0, fontSize: '0.75rem', color: '#a89a86', listStyleType: 'circle' }}>
                    <li>Uso Ilimitado</li>
                    <li>Suporte VIP</li>
                  </ul>
                </div>
                <button
                  className="btn-primary btn-sm"
                  style={{ width: '100%', padding: '8px', marginTop: '10px' }}
                  onClick={() => handleSubscribe('plan_unlimited')}
                  disabled={userPlan === 'plan_unlimited'}
                >
                  {userPlan === 'plan_unlimited' ? 'Ativo' : 'Assinar'}
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {step === 'history' && (
        <div className="step" style={{ width: '100%', maxWidth: '800px' }}>
          <div className="step-label">Histórico de Gerações</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Seus Ganchos Salvos</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {history.length > 0 && (
                <button className="btn-secondary btn-sm" style={{ color: '#ff4444', borderColor: 'rgba(255, 68, 68, 0.2)' }} onClick={clearAllHistory}>
                  Limpar Histórico
                </button>
              )}
              <button className="btn-secondary btn-sm" onClick={() => setStep('intro')}>
                Voltar ao Início
              </button>
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.7 }}>
              Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b6152' }}>
              Nenhuma geração salva ainda. Comece a criar para ver seu histórico!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {history.map((item) => {
                const dateStr = new Date(item.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const templateName = TEMPLATES.find((t) => t.id === item.template_id)?.title || `Template #${item.template_id}`;

                return (
                  <div key={item.id} style={{
                    background: 'rgba(215, 161, 60, 0.02)',
                    border: '1px solid rgba(215, 161, 60, 0.1)',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#d7a13c', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {templateName} · {item.cta}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#f3ece0' }}>
                          Nicho: {item.nicho}
                        </h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#6b6152' }}>
                          {dateStr}
                        </span>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          style={{
                            background: 'none',
                            color: '#ff4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,68,68,0.2)'
                          }}
                          title="Excluir este item"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#a59e92', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      <strong>Público (ICP):</strong> {item.icp}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => {
                          setNicho(item.nicho);
                          setIcp(item.icp);
                          setSelectedTemplateId(item.template_id);
                          setSelectedCta(item.cta);
                          setVariations(item.variations);
                          setCopiedIndex(null);
                          setStep('results');
                        }}
                      >
                        Visualizar Variações →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nicho.trim()) {
                setStep('icp');
              }
            }}
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
            placeholder="Ex: mulheres de 35-50 anos, na menopausa, frustradas por não conseguir emagrecer mesmo se exercitando, já tentaram várias dietas... (Pressione Ctrl+Enter para avançar)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && icp.trim()) {
                setStep('template');
              }
            }}
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
