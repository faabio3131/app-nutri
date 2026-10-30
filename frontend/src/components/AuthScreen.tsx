"use client";

import { useState } from 'react';
import { api, setToken, Usage } from '@/lib/api';

type Session = { token: string; user: { id: string; email: string; name: string }; usage: Usage };

export default function AuthScreen({ onSession }: { onSession: (s: Session) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = await api<Session>(mode === 'signup' ? '/auth/signup' : '/auth/login', {
        method: 'POST',
        body: mode === 'signup' ? { name, email, password, accept_terms: accept } : { email, password },
      });
      setToken(s.token);
      onSession(s);
    } catch (err: any) {
      setError(err.message || 'Não foi possível continuar.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-400';
  return (
    <div className="min-h-screen bg-[#070A0F] text-gray-100 flex items-center justify-center py-6 px-3 font-sans">
      <div className="w-full max-w-[430px] bg-[#0E131F] border border-cyan-500/20 rounded-[36px] shadow-2xl p-7">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white">Nutri<span className="text-cyan-400">Snap</span> IA</h1>
          <p className="text-xs text-gray-400 mt-1">Fotografe o prato. Veja calorias e macros em segundos.</p>
          <p className="inline-block mt-3 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-full">
            3 fotos grátis, sem cartão
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-[#0B0F17] p-1 rounded-xl border border-gray-800 mb-5" role="tablist">
          {(['signup', 'login'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(''); }}
              className={`py-2 text-xs font-black rounded-lg transition ${mode === m ? 'bg-cyan-400 text-slate-950' : 'text-gray-400 hover:text-white'}`}>
              {m === 'signup' ? 'Criar conta' : 'Entrar'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label htmlFor="nome" className="block text-[11px] font-bold text-gray-400 mb-1">Nome</label>
              <input id="nome" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Como quer ser chamado" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-[11px] font-bold text-gray-400 mb-1">E-mail</label>
            <input id="email" type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="seu@email.com" />
            {mode === 'signup' && <p className="text-[10px] text-gray-500 mt-1">Use o mesmo e-mail da compra do plano, para liberar o acesso automaticamente.</p>}
          </div>
          <div>
            <label htmlFor="senha" className="block text-[11px] font-bold text-gray-400 mb-1">Senha</label>
            <input id="senha" type="password" required minLength={8} maxLength={72} className={input} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="Mínimo de 8 caracteres" />
          </div>
          {mode === 'signup' && (
            <label className="flex items-start gap-2 text-[11px] text-gray-400 cursor-pointer">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="accent-cyan-400 w-4 h-4 mt-0.5" />
              <span>Tenho 18 anos ou mais, li e aceito os <a className="text-cyan-400 underline" href="/termos/" target="_blank" rel="noopener">Termos de Uso</a> e a <a className="text-cyan-400 underline" href="/privacidade/" target="_blank" rel="noopener">Política de Privacidade</a>, e <strong>consinto</strong> com o tratamento dos meus dados de saúde e alimentação (peso, altura, refeições) e com o envio das fotos dos pratos ao Google para análise.</span>
            </label>
          )}
          {error && <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{error}</p>}
          <button type="submit" disabled={busy || (mode === 'signup' && !accept)}
            className="w-full py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm shadow-xl shadow-cyan-400/20 transition">
            {busy ? 'Aguarde...' : mode === 'signup' ? 'Criar conta e testar grátis' : 'Entrar'}
          </button>
        </form>
        <p className="text-[10px] text-gray-500 text-center mt-5">As estimativas da IA são aproximadas e não substituem orientação de nutricionista ou médico.</p>
      </div>
    </div>
  );
}
