"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';

export type Closure = {
  date: string; consumed_kcal: number; burned_kcal: number; net_kcal: number; goal_kcal: number; diff_kcal: number;
  protein_g: number; carbs_g: number; fat_g: number; protein_goal_g: number; carb_goal_g: number; fat_goal_g: number;
  water_ml: number; water_goal_ml: number; verdict: 'deficit' | 'na_meta' | 'superavit'; closed_at: string;
};
type Goals = { calorie_target: number; protein_target_g: number; carb_target_g: number; fat_target_g: number; water_goal_ml: number };
type Live = { consumed: number; burned: number; net: number; protein: number; carbs: number; fat: number; meals: number };
export type Objective = 'lose' | 'gain' | 'keep';

const VERDICT_STYLE = {
  deficit: { icon: '🟦', border: 'border-sky-400/50', text: 'text-sky-300', label: 'Abaixo da meta' },
  na_meta: { icon: '✅', border: 'border-emerald-400/60', text: 'text-emerald-300', label: 'Na meta' },
  superavit: { icon: '🟧', border: 'border-amber-400/60', text: 'text-amber-300', label: 'Acima da meta' },
} as const;

export function verdictText(v: Closure['verdict'], diff: number, objective: Objective): string {
  const k = Math.abs(diff);
  if (v === 'na_meta') return 'Você fechou o dia dentro da meta. Constância é o que dá resultado.';
  if (v === 'deficit') {
    if (objective === 'lose') return `Déficit de ${k} kcal: bom ritmo para quem quer emagrecer. Sem exagerar: coma o suficiente para ter energia.`;
    if (objective === 'gain') return `Faltaram ${k} kcal para a sua meta. Para ganhar massa, vale incluir mais uma refeição ou lanche.`;
    return `Você ficou ${k} kcal abaixo da meta. Se foi de propósito, tudo bem; senão, inclua um lanche.`;
  }
  if (objective === 'gain') return `Superávit de ${k} kcal: adequado para quem quer ganhar peso, de preferência com boa proteína.`;
  if (objective === 'lose') return `Você passou ${k} kcal da meta. Um dia não define a semana: amanhã é só voltar ao plano.`;
  return `Você passou ${k} kcal da meta. Observe as porções e as bebidas calóricas.`;
}

export function dayTips(c: Pick<Closure, 'protein_g' | 'protein_goal_g' | 'water_ml' | 'water_goal_ml'>): string[] {
  const tips: string[] = [];
  if (c.protein_goal_g > 0 && c.protein_g < c.protein_goal_g * 0.8) tips.push(`Faltaram ${Math.round(c.protein_goal_g - c.protein_g)} g de proteína. Ovos, frango, atum, iogurte ou feijão ajudam.`);
  if (c.water_goal_ml > 0 && c.water_ml < c.water_goal_ml * 0.7) tips.push(`Você bebeu ${c.water_ml} ml de ${c.water_goal_ml} ml. Leve uma garrafa para amanhã.`);
  return tips;
}

function Bar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-300"><span>{label}</span><span>{value} / {goal}{label === 'Água' ? ' ml' : ' g'}</span></div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden mt-1" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CloseDayModal({ live, goals, waterMl, objective, existing, onClose, onClosed }: {
  live: Live; goals: Goals; waterMl: number; objective: Objective; existing: Closure | null; onClose: () => void; onClosed: (c: Closure) => void;
}) {
  const [closure, setClosure] = useState<Closure | null>(existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = async () => {
    setBusy(true); setError('');
    try {
      const r = await api<{ closure: Closure }>('/days/close', { method: 'POST', body: {
        calorie_goal: goals.calorie_target, protein_goal_g: goals.protein_target_g, carb_goal_g: goals.carb_target_g,
        fat_goal_g: goals.fat_target_g, water_ml: Math.round(waterMl), water_goal_ml: goals.water_goal_ml,
      } });
      setClosure(r.closure); onClosed(r.closure);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível fechar o dia.'); }
    finally { setBusy(false); }
  };

  const noData = live.meals === 0 && live.burned === 0;
  return (
    <Modal title={closure ? 'Balanço do dia' : 'Fechar o dia'} onClose={onClose}>
      {!closure ? (
        <div className="space-y-4">
          <p className="text-[11px] text-gray-400">Confira o resumo de hoje. Ao fechar, o balanço fica salvo no seu histórico.</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-emerald-500/30"><span className="text-[10px] text-gray-400 block">Ingeridas</span><b className="text-sm text-emerald-400">{live.consumed}</b></div>
            <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-rose-500/30"><span className="text-[10px] text-gray-400 block">Queimadas</span><b className="text-sm text-rose-400">{live.burned}</b></div>
            <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-cyan-500/30"><span className="text-[10px] text-gray-400 block">Saldo</span><b className="text-sm text-cyan-400">{live.net}</b></div>
          </div>
          <p className="text-[11px] text-gray-300 text-center">Meta do dia: <b>{goals.calorie_target} kcal</b></p>
          {noData && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">Você ainda não registrou refeições nem exercícios hoje. Registre antes de fechar para o balanço ser fiel.</p>}
          {error && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{error}</p>}
          <button onClick={close} disabled={busy} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-black text-sm transition">
            {busy ? 'Fechando...' : 'Fechar o dia'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl border ${VERDICT_STYLE[closure.verdict].border} bg-[#141B2D] p-4 text-center`}>
            <div className="text-2xl" aria-hidden>{VERDICT_STYLE[closure.verdict].icon}</div>
            <p className={`text-sm font-black ${VERDICT_STYLE[closure.verdict].text}`}>{VERDICT_STYLE[closure.verdict].label}</p>
            <p className="text-3xl font-black text-white mt-1">{closure.net_kcal} <span className="text-xs font-medium text-gray-400">kcal líquidas</span></p>
            <p className="text-[11px] text-gray-400">Meta {closure.goal_kcal} kcal • {closure.diff_kcal === 0 ? 'exatamente na meta' : `${closure.diff_kcal > 0 ? '+' : '−'}${Math.abs(closure.diff_kcal)} kcal`}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-emerald-500/30"><span className="text-[10px] text-gray-400 block">🍽️ Ingeridas</span><b className="text-sm text-emerald-400">+{closure.consumed_kcal} kcal</b></div>
            <div className="bg-[#0B0F17] rounded-xl p-2.5 border border-rose-500/30"><span className="text-[10px] text-gray-400 block">🔥 Queimadas</span><b className="text-sm text-rose-400">−{closure.burned_kcal} kcal</b></div>
          </div>
          <p className="text-xs text-gray-200 leading-relaxed">{verdictText(closure.verdict, closure.diff_kcal, objective)}</p>
          <div className="space-y-2.5">
            <Bar label="Proteínas" value={closure.protein_g} goal={closure.protein_goal_g} color="bg-cyan-400" />
            <Bar label="Carboidratos" value={closure.carbs_g} goal={closure.carb_goal_g} color="bg-blue-400" />
            <Bar label="Gorduras" value={closure.fat_g} goal={closure.fat_goal_g} color="bg-amber-400" />
            <Bar label="Água" value={closure.water_ml} goal={closure.water_goal_ml} color="bg-sky-400" />
          </div>
          {dayTips(closure).length > 0 && (
            <ul className="text-[11px] text-gray-300 space-y-1 bg-[#0B0F17] border border-gray-800 rounded-xl p-3">
              {dayTips(closure).map((t, i) => <li key={i}>💡 {t}</li>)}
            </ul>
          )}
          <p className="text-[10px] text-gray-500">Estimativas aproximadas. As calorias queimadas contam só o exercício (além do gasto basal). Não substitui orientação de nutricionista ou médico.</p>
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={close} disabled={busy} className="py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold disabled:opacity-60">{busy ? 'Atualizando...' : 'Atualizar com dados de agora'}</button>
            <button onClick={onClose} className="py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black">Concluir</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
