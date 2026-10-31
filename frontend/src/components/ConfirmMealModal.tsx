"use client";

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import Modal from './Modal';
import type { AnalyzeResponse } from '@/features/meal-scanner/mealScannerService';

type Unit = 'ml' | 'g';

// Depois da foto: o usuário confere o que a IA entendeu (nome) e informa a quantidade real (ml/g).
// Se mudar algo, a refeição é recalculada; se estiver certo, nada é gasto.
export default function ConfirmMealModal({ scan, onClose, onRefined }: {
  scan: AnalyzeResponse; onClose: () => void; onRefined: (r: AnalyzeResponse['data']) => void;
}) {
  const s = scan.data.meal_summary;
  const itemsWeight = Math.round(scan.data.items.reduce((a, i) => a + (i.estimated_weight_g || 0), 0));
  const initAmount = Math.round(s.serving_amount && s.serving_amount > 0 ? s.serving_amount : itemsWeight) || 100;
  const initUnit: Unit = s.serving_unit === 'ml' || (!s.serving_unit && s.is_liquid) ? 'ml' : 'g';
  const [name, setName] = useState(s.name);
  const [amount, setAmount] = useState(String(initAmount));
  const [unit, setUnit] = useState<Unit>(initUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = Number(amount);
  const validAmount = Number.isFinite(n) && n >= 1 && n <= 5000;
  const changed = name.trim() !== s.name || n !== initAmount || unit !== initUnit;
  const options = [s.name, ...(s.alternatives || [])].filter((v, i, a) => v && a.indexOf(v) === i);
  const doubt = (s.confidence_level || '').toUpperCase().startsWith('BAIXO');

  const confirm = async () => {
    if (!changed) { onClose(); return; }
    setBusy(true); setError('');
    try {
      const r = await api<{ data: AnalyzeResponse['data'] }>(`/meals/${scan.meal_id}/refine`, { method: 'POST', body: { name: name.trim(), amount: n, unit } });
      onRefined(r.data); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível recalcular.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Confere o que é?" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[11px] text-gray-300">A IA estima pela aparência e pode errar (por exemplo, iogurte e leite parecem iguais). Confirme o nome e a quantidade para um cálculo mais certo.</p>
        {doubt && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">A IA ficou em dúvida com esta foto. Vale conferir.</p>}
        <div>
          <label htmlFor="cm-name" className="block text-[11px] font-bold text-gray-400 mb-1">O que é?</label>
          <input id="cm-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400" />
          {options.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Sugestões">
              {options.map((o) => (
                <button type="button" key={o} aria-pressed={name === o} onClick={() => setName(o)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border ${name === o ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-700'}`}>{o}</button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="cm-amount" className="block text-[11px] font-bold text-gray-400 mb-1">Quantidade</label>
          <div className="flex gap-2">
            <input id="cm-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} className="flex-1 min-w-0 bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400" />
            <div className="grid grid-cols-2 gap-1 bg-[#0B0F17] p-1 rounded-xl border border-gray-800" role="group" aria-label="Unidade">
              {(['ml', 'g'] as const).map((u) => (
                <button type="button" key={u} aria-pressed={unit === u} onClick={() => setUnit(u)} className={`px-4 text-xs font-black rounded-lg ${unit === u ? 'bg-cyan-400 text-slate-950' : 'text-gray-400'}`}>{u}</button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Um copo comum tem cerca de 200 ml; um pote de iogurte, de 100 a 170 g.</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-[#0B0F17] p-3 text-center">
          <p className="text-[10px] text-gray-400">Estimativa atual da IA</p>
          <b className="text-lg text-emerald-400">{Math.round(s.total_calories)} kcal</b>
        </div>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        <button onClick={confirm} disabled={busy || name.trim().length < 2 || !validAmount} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm">
          {busy ? 'Recalculando...' : changed ? 'Recalcular com isso' : 'Está certo'}
        </button>
        {changed && <button onClick={onClose} disabled={busy} className="w-full py-2 text-xs text-gray-400 underline">Manter a estimativa da IA</button>}
      </div>
    </Modal>
  );
}
