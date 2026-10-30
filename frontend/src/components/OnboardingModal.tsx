"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';

export type Profile = { weight: number; target: number; height: number; age: number; gender: string; activity: string };
export const ACTIVITY_OPTIONS: [string, string][] = [['sedentary', 'Sedentário'], ['light', 'Leve (1 a 3 dias/semana)'], ['moderate', 'Moderado (3 a 5 treinos/semana)'], ['intense', 'Intenso']];

export default function OnboardingModal({ initial, onClose, onSkip, onDone }: {
  initial: Profile; onClose: () => void; onSkip: () => void; onDone: (goals: any, profile: Profile) => void;
}) {
  const [p, setP] = useState({ weight: String(initial.weight), target: String(initial.target), height: String(initial.height), age: String(initial.age), gender: initial.gender, activity: 'light' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = 'w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const n = { weight: Number(p.weight.replace(',', '.')), target: Number(p.target.replace(',', '.')), height: Number(p.height), age: Number(p.age) };
    try {
      const r = await api<{ data: any }>('/nutrition/calculate', { method: 'POST', body: { weight_kg: n.weight, target_weight_kg: n.target, height_cm: n.height, age: n.age, gender: p.gender, activity_level: p.activity } });
      await api('/weight', { method: 'POST', body: { weight_kg: n.weight } }).catch(() => undefined);
      onDone(r.data, { ...n, gender: p.gender, activity: ACTIVITY_OPTIONS.find(([k]) => k === p.activity)?.[1] || 'Leve (1 a 3 dias/semana)' });
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível calcular.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Vamos ajustar suas metas" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[11px] text-gray-400">Em 30 segundos o app calcula calorias, macros e água ideais para você. Sem isso, usamos uma meta genérica de 2000 kcal.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="ob-w" className="block text-[11px] font-bold text-gray-400 mb-1">Peso atual (kg)</label><input id="ob-w" inputMode="decimal" required value={p.weight} onChange={set('weight')} className={field} /></div>
          <div><label htmlFor="ob-t" className="block text-[11px] font-bold text-gray-400 mb-1">Peso desejado (kg)</label><input id="ob-t" inputMode="decimal" required value={p.target} onChange={set('target')} className={field} /></div>
          <div><label htmlFor="ob-h" className="block text-[11px] font-bold text-gray-400 mb-1">Altura (cm)</label><input id="ob-h" inputMode="numeric" required value={p.height} onChange={set('height')} className={field} /></div>
          <div><label htmlFor="ob-a" className="block text-[11px] font-bold text-gray-400 mb-1">Idade</label><input id="ob-a" inputMode="numeric" required value={p.age} onChange={set('age')} className={field} /></div>
        </div>
        <div><label htmlFor="ob-g" className="block text-[11px] font-bold text-gray-400 mb-1">Sexo biológico (usado na fórmula)</label>
          <select id="ob-g" value={p.gender} onChange={set('gender')} className={field}><option value="female">Feminino</option><option value="male">Masculino</option></select></div>
        <div><label htmlFor="ob-act" className="block text-[11px] font-bold text-gray-400 mb-1">Nível de atividade</label>
          <select id="ob-act" value={p.activity} onChange={set('activity')} className={field}>{ACTIVITY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {error && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-black text-sm">{busy ? 'Calculando...' : 'Calcular e começar'}</button>
        <button type="button" onClick={onSkip} className="w-full py-2 text-[11px] text-gray-400 underline">Pular por enquanto</button>
        <p className="text-[10px] text-gray-500">Estimativa geral (fórmula de Mifflin-St Jeor); não substitui avaliação profissional.</p>
      </form>
    </Modal>
  );
}
