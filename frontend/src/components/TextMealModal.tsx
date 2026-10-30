"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';

const EXAMPLES = ['2 ovos mexidos e 1 pão francês com manteiga', 'prato de arroz, feijão, bife e salada', '1 copo de suco de laranja e 2 fatias de bolo'];
const TYPES: [string, string][] = [['', 'Automático'], ['cafe', 'Café'], ['almoco', 'Almoço'], ['lanche', 'Lanche'], ['jantar', 'Jantar'], ['outro', 'Outro']];

export default function TextMealModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [mealType, setMealType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ name: string; kcal: number; p: number; c: number; f: number } | null>(null);
  const valid = text.trim().length >= 3 && text.length <= 300;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    try {
      const r = await api<{ data: { meal_summary: any } }>('/meals/text', { method: 'POST', body: { text: text.trim(), meal_type: mealType } });
      const m = r.data.meal_summary;
      setResult({ name: m.name, kcal: Math.round(m.total_calories), p: Math.round(m.total_protein_g), c: Math.round(m.total_carbs_g), f: Math.round(m.total_fat_g) });
      onSaved();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível analisar agora.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Digitar o que comi" onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <div className="bg-[#141B2D] border border-emerald-500/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase font-bold text-emerald-400">Registrado</p>
            <h3 className="text-sm font-black text-white">{result.name}</h3>
            <p className="text-2xl font-black text-emerald-400 mt-1">{result.kcal} kcal</p>
            <p className="text-[11px] text-gray-300">Proteína {result.p} g • Carbo {result.c} g • Gordura {result.f} g</p>
          </div>
          <p className="text-[10px] text-gray-500">Estimativa por IA a partir do seu texto. Se a porção estiver diferente, ajuste na lista de refeições (toque em &quot;Editar&quot;).</p>
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm">Concluir</button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <p className="text-[11px] text-gray-400">Sem foto? Escreva o que comeu e a IA estima calorias e macros. Não gasta suas fotos.</p>
          <div>
            <label htmlFor="tm-text" className="block text-[11px] font-bold text-gray-400 mb-1">O que você comeu ou bebeu</label>
            <textarea id="tm-text" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: 2 ovos mexidos e 1 pão francês"
              className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 resize-none" />
            <div className="text-[10px] text-gray-500 text-right">{text.length}/300</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => <button type="button" key={ex} onClick={() => setText(ex)} className="text-[10px] px-2 py-1 rounded-full bg-[#0B0F17] border border-gray-800 text-gray-300 hover:border-cyan-400 text-left">{ex}</button>)}
          </div>
          <div>
            <label htmlFor="tm-type" className="block text-[11px] font-bold text-gray-400 mb-1">Refeição</label>
            <select id="tm-type" value={mealType} onChange={(e) => setMealType(e.target.value)} className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">{error}</p>}
          <button type="submit" disabled={busy || !valid} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm">{busy ? 'Analisando...' : 'Analisar e registrar'}</button>
        </form>
      )}
    </Modal>
  );
}
