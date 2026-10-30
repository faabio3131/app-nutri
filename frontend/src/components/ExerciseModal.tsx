"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ACTIVITIES, INTENSITIES, Intensity, estimateBurn } from '@/lib/activities';
import Modal from './Modal';

export default function ExerciseModal({ weightKg, onClose, onSaved }: { weightKg: number; onClose: () => void; onSaved: () => void }) {
  const [activity, setActivity] = useState('caminhada');
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>('moderada');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 600;
  const est = valid ? estimateBurn(activity, minutes, intensity, weightKg) : 0;
  const field = 'w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    try {
      await api('/workouts', { method: 'POST', body: { activity_type: activity, duration_min: Math.round(minutes), intensity, weight_kg: weightKg } });
      onSaved(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível registrar.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Registrar exercício" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label htmlFor="ex-act" className="block text-[11px] font-bold text-gray-400 mb-1">Atividade</label>
          <select id="ex-act" value={activity} onChange={(e) => setActivity(e.target.value)} className={field}>
            {ACTIVITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ex-min" className="block text-[11px] font-bold text-gray-400 mb-1">Duração (minutos)</label>
          <input id="ex-min" type="number" inputMode="numeric" min={1} max={600} value={Number.isFinite(minutes) ? minutes : ''} onChange={(e) => setMinutes(Number(e.target.value))} className={field} />
          <div className="flex gap-2 mt-2">
            {[15, 30, 45, 60].map((m) => (
              <button type="button" key={m} onClick={() => setMinutes(m)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border ${minutes === m ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-800'}`}>{m} min</button>
            ))}
          </div>
        </div>
        <fieldset>
          <legend className="block text-[11px] font-bold text-gray-400 mb-1">Intensidade</legend>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITIES.map((i) => (
              <button type="button" key={i.id} aria-pressed={intensity === i.id} onClick={() => setIntensity(i.id)}
                className={`py-2 rounded-xl text-xs font-bold border ${intensity === i.id ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-800'}`}>{i.label}</button>
            ))}
          </div>
        </fieldset>
        <div className="rounded-xl border border-rose-500/30 bg-[#0B0F17] p-3 text-center">
          <span className="text-[10px] text-gray-400 block">Gasto estimado (exercício, além do basal)</span>
          <b className="text-xl text-rose-400">🔥 {est} kcal</b>
          <span className="text-[10px] text-gray-500 block">calculado com {Math.round(weightKg)} kg</span>
        </div>
        {error && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{error}</p>}
        <button type="submit" disabled={busy || !valid} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm">{busy ? 'Salvando...' : 'Registrar exercício'}</button>
      </form>
    </Modal>
  );
}
