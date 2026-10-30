"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';

export type EditableMeal = { id: string; name: string; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number };
const FACTORS: [number, string][] = [[0.5, '½×'], [0.75, '¾×'], [1.25, '1¼×'], [1.5, '1½×'], [2, '2×']];

export default function MealEditModal({ meal, onClose, onSaved }: { meal: EditableMeal; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(meal.name);
  const [factor, setFactor] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const k = (v: number) => Math.round(v * factor);
  const changed = factor !== 1 || name.trim() !== meal.name;

  const save = async () => {
    setBusy(true); setError('');
    try {
      const body: Record<string, unknown> = {};
      if (factor !== 1) body.factor = factor;
      if (name.trim() !== meal.name) body.name = name.trim();
      await api(`/meals/${meal.id}`, { method: 'PATCH', body });
      onSaved(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Editar refeição" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label htmlFor="me-name" className="block text-[11px] font-bold text-gray-400 mb-1">Nome</label>
          <input id="me-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400" />
        </div>
        <fieldset>
          <legend className="block text-[11px] font-bold text-gray-400 mb-1">Ajustar a porção (a IA errou o tamanho?)</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {FACTORS.map(([f, l]) => (
              <button type="button" key={f} aria-pressed={factor === f} onClick={() => setFactor(factor === f ? 1 : f)}
                className={`py-2 rounded-lg text-xs font-bold border ${factor === f ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-800'}`}>{l}</button>
            ))}
          </div>
        </fieldset>
        <div className="rounded-xl border border-gray-800 bg-[#0B0F17] p-3 text-center">
          <b className="text-xl text-emerald-400">{k(meal.total_calories)} kcal</b>
          <p className="text-[11px] text-gray-300">Proteína {k(meal.total_protein_g)} g • Carbo {k(meal.total_carbs_g)} g • Gordura {k(meal.total_fat_g)} g</p>
        </div>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        <button onClick={save} disabled={busy || !changed || name.trim() === ''} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm">{busy ? 'Salvando...' : 'Salvar alterações'}</button>
      </div>
    </Modal>
  );
}
