"use client";

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Day = { date: string; consumed_kcal: number; burned_kcal: number; net_kcal: number; protein_g: number; meals: number; closed: boolean; goal_kcal?: number; verdict?: string; water_ml?: number };
type W = { date: string; kg: number };
const VLABEL: Record<string, { t: string; c: string }> = {
  deficit: { t: 'Abaixo', c: 'text-sky-300 border-sky-400/40' },
  na_meta: { t: 'Na meta', c: 'text-emerald-300 border-emerald-400/40' },
  superavit: { t: 'Acima', c: 'text-amber-300 border-amber-400/40' },
};
const dlabel = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const wd = (iso: string) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(iso + 'T12:00:00').getDay()];

function WeightChart({ points, target }: { points: W[]; target: number }) {
  if (points.length < 2) return <p className="text-[11px] text-gray-400 text-center py-4">Registre seu peso em pelo menos 2 dias para ver a curva.</p>;
  const W_ = 360, H = 130, pad = 24;
  const vals = points.map((p) => p.kg).concat(target > 0 ? [target] : []);
  const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
  const x = (i: number) => pad + (i * (W_ - pad * 2)) / (points.length - 1);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W_} ${H}`} className="w-full" role="img" aria-label={`Curva de peso: de ${points[0].kg} kg para ${points[points.length - 1].kg} kg`}>
      {target > 0 && <><line x1={pad} x2={W_ - pad} y1={y(target)} y2={y(target)} stroke="#34d399" strokeDasharray="4 4" strokeWidth="1" /><text x={W_ - pad} y={y(target) - 4} textAnchor="end" fontSize="9" fill="#34d399">meta {target} kg</text></>}
      <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.kg)} r="3" fill="#22d3ee" />)}
      <text x={x(0)} y={H - 6} fontSize="9" fill="#9ca3af" textAnchor="start">{dlabel(points[0].date)}</text>
      <text x={x(points.length - 1)} y={H - 6} fontSize="9" fill="#9ca3af" textAnchor="end">{dlabel(points[points.length - 1].date)}</text>
    </svg>
  );
}

export default function HistoryTab({ calorieGoal, targetWeight, currentWeight, refreshKey, onWeightSaved, onAuthError }: {
  calorieGoal: number; targetWeight: number; currentWeight: number; refreshKey: number; onWeightSaved: (kg: number) => void; onAuthError: (e: unknown) => boolean;
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const [days, setDays] = useState<Day[] | null>(null);
  const [weights, setWeights] = useState<W[]>([]);
  const [error, setError] = useState('');
  const [kg, setKg] = useState(String(currentWeight));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api<{ days: Day[]; weights: W[] }>(`/history?days=${range}`);
      setDays(r.days); setWeights(r.weights);
    } catch (e) { if (!onAuthError(e)) setError(e instanceof ApiError ? e.message : 'Não foi possível carregar o histórico.'); }
  }, [range, onAuthError]);
  useEffect(() => { setDays(null); load(); }, [load, refreshKey]);

  const saveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(kg.replace(',', '.'));
    if (!(v >= 30 && v <= 300)) { setMsg('Informe um peso entre 30 e 300 kg.'); return; }
    setSaving(true); setMsg('');
    try {
      const r = await api<{ weights: W[] }>('/weight', { method: 'POST', body: { weight_kg: v } });
      setWeights(r.weights); onWeightSaved(v); setMsg('Peso de hoje salvo.');
    } catch (err) { if (!onAuthError(err)) setMsg(err instanceof ApiError ? err.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  const logged = (days || []).filter((d) => d.meals > 0);
  const avg = (f: (d: Day) => number) => (logged.length ? Math.round(logged.reduce((a, d) => a + f(d), 0) / logged.length) : 0);
  const closedDays = (days || []).filter((d) => d.closed);
  const onGoal = closedDays.filter((d) => d.verdict === 'na_meta').length;
  const maxBar = Math.max(calorieGoal * 1.2, ...(days || []).map((d) => d.consumed_kcal), 1);
  const firstW = weights[0]?.kg, lastW = weights[weights.length - 1]?.kg;
  const diffW = firstW !== undefined && lastW !== undefined ? Math.round((lastW - firstW) * 10) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-white">Histórico</h2>
        <div className="grid grid-cols-2 gap-1 bg-[#0B0F17] p-1 rounded-xl border border-gray-800" role="group" aria-label="Período">
          {([7, 30] as const).map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} className={`px-3 py-1 text-[11px] font-black rounded-lg ${range === r ? 'bg-cyan-400 text-slate-950' : 'text-gray-400'}`}>{r} dias</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error} <button onClick={load} className="underline">Tentar de novo</button></p>}
      {!days && !error && <p className="text-xs text-gray-400 text-center py-6">Carregando...</p>}
      {days && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#141B2D] border border-gray-800 rounded-xl p-2.5"><span className="text-[10px] text-gray-400 block">Média ingerida</span><b className="text-sm text-emerald-400">{avg((d) => d.consumed_kcal)}</b><span className="text-[9px] text-gray-500 block">kcal/dia</span></div>
            <div className="bg-[#141B2D] border border-gray-800 rounded-xl p-2.5"><span className="text-[10px] text-gray-400 block">Média queimada</span><b className="text-sm text-rose-400">{avg((d) => d.burned_kcal)}</b><span className="text-[9px] text-gray-500 block">kcal/dia</span></div>
            <div className="bg-[#141B2D] border border-gray-800 rounded-xl p-2.5"><span className="text-[10px] text-gray-400 block">Dias na meta</span><b className="text-sm text-cyan-400">{onGoal}/{closedDays.length}</b><span className="text-[9px] text-gray-500 block">dias fechados</span></div>
          </div>
          {logged.length === 0 ? (
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-5 text-center text-xs text-gray-400">Ainda não há refeições nesse período. Registre refeições e feche o dia para acompanhar sua evolução.</div>
          ) : (
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Calorias ingeridas por dia <span className="text-emerald-400 normal-case">(linha = meta {calorieGoal})</span></p>
              <div className="relative flex items-end gap-1 h-28" role="img" aria-label={`Calorias por dia nos últimos ${range} dias`}>
                <div className="absolute left-0 right-0 border-t border-dashed border-emerald-400/60" style={{ bottom: `${(calorieGoal / maxBar) * 100}%` }} />
                {days.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${dlabel(d.date)}: ${d.consumed_kcal} kcal`}>
                    <div className={`${d.consumed_kcal > calorieGoal * 1.05 ? 'bg-amber-400' : 'bg-cyan-400'} rounded-t`} style={{ height: `${(d.consumed_kcal / maxBar) * 100}%`, minHeight: d.consumed_kcal > 0 ? 2 : 0 }} />
                  </div>
                ))}
              </div>
              {range === 7 && <div className="flex gap-1 mt-1">{days.map((d) => <span key={d.date} className="flex-1 text-center text-[9px] text-gray-500">{wd(d.date)}</span>)}</div>}
            </div>
          )}
          <div className="bg-[#141B2D] border border-gray-800 rounded-2xl divide-y divide-gray-800/70">
            {[...days].reverse().filter((d) => d.meals > 0 || d.burned_kcal > 0 || d.closed).slice(0, range === 7 ? 7 : 30).map((d) => (
              <div key={d.date} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold text-white">{wd(d.date)} {dlabel(d.date)}</p>
                  <p className="text-[10px] text-gray-400">🍽️ {d.consumed_kcal} • 🔥 {d.burned_kcal} • saldo <b className="text-gray-200">{d.net_kcal}</b> kcal</p>
                </div>
                {d.closed && d.verdict ? <span className={`text-[10px] font-black border rounded-full px-2 py-0.5 ${VLABEL[d.verdict]?.c || ''}`}>{VLABEL[d.verdict]?.t || ''}</span> : <span className="text-[10px] text-gray-500">sem fechamento</span>}
              </div>
            ))}
            {days.every((d) => d.meals === 0 && d.burned_kcal === 0 && !d.closed) && <p className="px-4 py-4 text-[11px] text-gray-400 text-center">Nada registrado neste período.</p>}
          </div>
        </>
      )}
      <div className="bg-[#141B2D] border border-cyan-500/30 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white">⚖️ Evolução do peso</h3>
          {weights.length >= 2 && <span className={`text-[11px] font-black ${diffW <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>{diffW > 0 ? '+' : ''}{diffW} kg</span>}
        </div>
        <WeightChart points={weights} target={targetWeight} />
        <form onSubmit={saveWeight} className="flex gap-2">
          <input type="text" inputMode="decimal" aria-label="Peso de hoje em kg" value={kg} onChange={(e) => setKg(e.target.value)} className="flex-1 bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400" placeholder="Peso de hoje (kg)" />
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-black text-xs">{saving ? '...' : 'Salvar peso'}</button>
        </form>
        {msg && <p role="status" className="text-[11px] text-cyan-300">{msg}</p>}
      </div>
    </div>
  );
}
