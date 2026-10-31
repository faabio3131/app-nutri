"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import Modal from './Modal';
import { calcMeal, loadCatalog, Catalog, CatalogFood, CalcResult, CalcResponse, ScanResponse } from '@/features/meal-scanner/mealScannerService';

type Row = { key: number; food_id: string; name: string; grams: string; qty: string; share: number };
const QUICK = ['feijao_carioca', 'arroz_branco', 'ovo_frito', 'farofa', 'alface', 'batata_frita'];
const ML_CHIPS = [200, 250, 300, 350, 500, 600];
const GROUP_ORDER = ['leite', 'iogurte', 'refrigerante', 'suco', 'outras'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Depois da foto: a IA só LEU o que viu. Aqui o usuário confere itens/bebida, complementa o que a foto não mostra
// e o app calcula pela tabela (TACO). Nada é gasto de novo: a prévia é grátis.
export default function MealBuilderModal({ scan, onClose, onSaved }: {
  scan: ScanResponse; onClose: () => void; onSaved: (r: CalcResponse) => void;
}) {
  const s = scan.scan;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mode, setMode] = useState<'prato' | 'bebida'>(s.kind === 'bebida' ? 'bebida' : 'prato');
  const keyRef = useRef(0);
  const [rows, setRows] = useState<Row[]>(() => s.items.map((i) => ({ key: keyRef.current++, food_id: i.food_id, name: i.name, grams: '', qty: '', share: i.volume_share || 1 })));
  const [totalG, setTotalG] = useState('');
  const [complement, setComplement] = useState('');
  const [search, setSearch] = useState('');
  const [drinkId, setDrinkId] = useState(s.drink.drink_id);
  const [ml, setMl] = useState(s.drink.volume_ml > 0 ? String(Math.round(s.drink.volume_ml)) : '');
  const [label, setLabel] = useState(s.drink.label_kcal_100ml > 0 ? String(s.drink.label_kcal_100ml) : '');
  const [preview, setPreview] = useState<CalcResult | null>(null);
  const [needGrams, setNeedGrams] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => { loadCatalog().then(setCatalog).catch(() => setLoadErr(true)); }, []);
  const foodById = useMemo(() => new Map((catalog?.foods || []).map((f) => [f.id, f])), [catalog]);
  const drinkById = useMemo(() => new Map((catalog?.drinks || []).map((d) => [d.id, d])), [catalog]);
  const groupOf = drinkId ? drinkById.get(drinkId)?.group : undefined;
  const [group, setGroup] = useState<string>('');
  useEffect(() => { if (groupOf && !group) setGroup(groupOf); }, [groupOf, group]);

  const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const payload = (save: boolean) => mode === 'bebida'
    ? { mode: 'bebida' as const, save, meal_type: scan.meal_type, drink: { drink_id: drinkId, ml: num(ml), label_kcal_100ml: num(label) || undefined } }
    : {
      mode: 'prato' as const, save, meal_type: scan.meal_type,
      items: rows.map((r) => ({ food_id: r.food_id, name: r.name, grams: num(r.grams) || undefined, qty: num(r.qty) || undefined, share: r.share })),
      total_g: num(totalG) || undefined, scan_total_g: s.estimated_total_g || undefined, complement: complement.trim() || undefined,
    };
  const ready = mode === 'bebida' ? !!drinkId && num(ml) >= 1 && num(ml) <= 3000 : rows.length > 0 || complement.trim().length >= 2;

  // Prévia ao vivo (grátis, só tabela), com atraso para não chamar a cada tecla.
  useEffect(() => {
    if (!ready) { setPreview(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await calcMeal(payload(false));
        if (!alive) return;
        setError('');
        setNeedGrams(r.status === 'need_grams' ? r.result.need_grams || [] : []);
        setPreview(r.status === 'need_grams' ? null : r.result);
      } catch (e) { if (alive) { setPreview(null); setError(e instanceof ApiError ? e.message : 'Não foi possível calcular.'); } }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rows, totalG, complement, drinkId, ml, label, ready]);

  const addFood = (f: CatalogFood) => {
    if (rows.some((r) => r.food_id === f.id)) return;
    setRows((p) => [...p, { key: keyRef.current++, food_id: f.id, name: f.name, grams: '', qty: '', share: 1 }]);
    setSearch('');
  };
  const addFreeText = () => {
    const name = search.trim();
    if (name.length < 2) return;
    setRows((p) => [...p, { key: keyRef.current++, food_id: '', name, grams: '', qty: '', share: 1 }]);
    setSearch('');
  };
  const results = useMemo(() => {
    const q = norm(search.trim());
    if (q.length < 2 || !catalog) return [];
    return catalog.foods.filter((f) => norm(f.name).includes(q) && !rows.some((r) => r.food_id === f.id)).slice(0, 6);
  }, [search, catalog, rows]);
  const setRow = (key: number, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const computed = (id: string, name: string) => preview?.items.find((i) => (id ? i.food_id === id : i.name === name));

  const save = async () => {
    setBusy(true); setError('');
    try { onSaved(await calcMeal(payload(true))); onClose(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível registrar.'); }
    finally { setBusy(false); }
  };

  const inputCls = 'bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400';
  const doubt = (s.confidence || '').toUpperCase().startsWith('BAIXO');
  const hasFree = rows.some((r) => !r.food_id);
  const canSave = ready && !!preview && needGrams.length === 0 && !busy;

  return (
    <Modal title={mode === 'bebida' ? 'Confere a bebida' : 'Eu vi:'} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[11px] text-gray-300">A IA só lê a foto e pode errar. Confira, complemente o que ela não enxerga e o cálculo sai da tabela TACO.</p>
        {doubt && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">A IA ficou em dúvida com esta foto. Vale conferir{s.alternatives.length ? `: pode ser ${s.alternatives.join(', ')}` : ''}.</p>}
        <div className="grid grid-cols-2 gap-1 bg-[#0B0F17] p-1 rounded-xl border border-gray-800" role="group" aria-label="Tipo">
          {(['prato', 'bebida'] as const).map((m) => (
            <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`py-2 text-xs font-black rounded-lg ${mode === m ? 'bg-cyan-400 text-slate-950' : 'text-gray-400'}`}>{m === 'prato' ? 'Prato / comida' : 'Bebida'}</button>
          ))}
        </div>
        {loadErr && <p role="alert" className="text-xs text-rose-300">Não consegui carregar a tabela. Feche e tente de novo.</p>}

        {mode === 'prato' ? (
          <>
            <ul className="space-y-2" aria-label="Itens do prato">
              {rows.map((r) => {
                const f = foodById.get(r.food_id);
                const c = computed(r.food_id, r.name);
                const unit = !!f && f.unit_g > 0;
                return (
                  <li key={r.key} className="bg-[#141B2D] border border-gray-800 rounded-xl p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{f?.name || r.name}</span>
                      <button type="button" aria-label={`Remover ${f?.name || r.name}`} onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))} className="text-gray-400 hover:text-rose-300 px-2">✕</button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {unit ? (
                        <>
                          <label htmlFor={`q${r.key}`} className="text-[10px] text-gray-400">Unidades</label>
                          <input id={`q${r.key}`} inputMode="decimal" value={r.qty} placeholder="1" onChange={(e) => setRow(r.key, { qty: e.target.value })} className={`${inputCls} w-20 py-1.5`} />
                        </>
                      ) : (
                        <>
                          <label htmlFor={`g${r.key}`} className="text-[10px] text-gray-400">Gramas</label>
                          <input id={`g${r.key}`} inputMode="decimal" value={r.grams} placeholder={c ? `${Math.round(c.grams)}` : f?.needs_grams || !f ? 'obrigatório' : 'auto'} onChange={(e) => setRow(r.key, { grams: e.target.value })} className={`${inputCls} w-28 py-1.5`} />
                        </>
                      )}
                      <span className="text-[10px] text-gray-500 ml-auto">{c ? `${Math.round(c.grams)} g • ${Math.round(c.calories)} kcal` : ''}</span>
                    </div>
                    {!r.food_id && <p className="text-[10px] text-amber-300 mt-1">Fora da tabela: a IA estima as calorias ao registrar (informe os gramas).</p>}
                  </li>
                );
              })}
              {rows.length === 0 && <li className="text-[11px] text-gray-400">Nenhum item. Adicione abaixo ou escreva no complemento.</li>}
            </ul>

            {scan.hints.filter((h) => !rows.some((r) => r.food_id === h.add_id)).map((h) => {
              const f = foodById.get(h.add_id);
              return f ? (
                <button type="button" key={h.add_id} onClick={() => addFood(f)} className="w-full text-left text-[11px] text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-2.5">
                  {h.text} <b>Toque para adicionar {f.name.toLowerCase()}</b>
                </button>
              ) : null;
            })}

            <div>
              <label htmlFor="mb-add" className="block text-[11px] font-bold text-gray-400 mb-1">+ Adicionar item</label>
              <div className="flex gap-2">
                <input id="mb-add" value={search} maxLength={60} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar: feijão, ovo, nhoque..." className={`${inputCls} flex-1 min-w-0`} />
                <button type="button" onClick={addFreeText} disabled={search.trim().length < 2} className="px-3 text-[11px] font-black rounded-xl border border-gray-700 text-gray-300 disabled:opacity-40">Outro</button>
              </div>
              {results.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Resultados">
                  {results.map((f) => <button type="button" key={f.id} onClick={() => addFood(f)} className="px-2.5 py-1.5 rounded-full text-[11px] font-bold border bg-[#0B0F17] text-gray-200 border-gray-700 hover:border-cyan-400">{f.name}</button>)}
                </div>
              )}
              {search.trim().length < 2 && catalog && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Atalhos">
                  {QUICK.map((id) => foodById.get(id)).filter((f): f is CatalogFood => !!f && !rows.some((r) => r.food_id === f.id)).map((f) => (
                    <button type="button" key={f.id} onClick={() => addFood(f)} className="px-2.5 py-1.5 rounded-full text-[11px] font-bold border bg-[#0B0F17] text-gray-300 border-gray-700 hover:border-cyan-400">+ {f.name}</button>
                  ))}
                </div>
              )}
              {search.trim().length >= 2 && results.length === 0 && catalog && <p className="text-[10px] text-gray-500 mt-1">Não está na tabela. Toque em &quot;Outro&quot; para a IA estimar (usa o mesmo limite das fotos).</p>}
            </div>

            <div>
              <label htmlFor="mb-comp" className="block text-[11px] font-bold text-gray-400 mb-1">Complemento (o que a foto não mostra)</label>
              <textarea id="mb-comp" rows={2} maxLength={200} value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Ex.: feijão preto por baixo do arroz; nhoque ao molho de tomate" className={`${inputCls} w-full resize-none`} />
              <p className="text-[10px] text-gray-500">Reconheço alimentos da tabela no texto (&quot;2 ovos&quot;, &quot;200 g de farofa&quot;). O resto fica como observação.</p>
            </div>

            <div>
              <label htmlFor="mb-total" className="block text-[11px] font-bold text-gray-400 mb-1">Peso total do prato em gramas (opcional)</label>
              <input id="mb-total" inputMode="decimal" value={totalG} placeholder={s.estimated_total_g ? `a IA viu ~${Math.round(s.estimated_total_g)} g` : 'Ex.: 700'} onChange={(e) => setTotalG(e.target.value)} className={`${inputCls} w-full`} />
              <p className="text-[10px] text-gray-500">Com o peso da balança, o cálculo fica bem mais certo. Sem ele, é estimativa.</p>
            </div>
          </>
        ) : (
          <>
            {s.drink.brand && <p className="text-[11px] text-gray-300">Rótulo lido: <b>{s.drink.brand}</b></p>}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de bebida">
              {GROUP_ORDER.map((g) => {
                const lbl = catalog?.drinks.find((d) => d.group === g)?.group_label;
                return lbl ? <button type="button" key={g} aria-pressed={group === g} onClick={() => setGroup(g)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${group === g ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-700'}`}>{lbl}</button> : null;
              })}
            </div>
            <div role="radiogroup" aria-label="Qual é" className="space-y-1.5">
              {(catalog?.drinks || []).filter((d) => d.group === group).map((d) => (
                <button type="button" role="radio" aria-checked={drinkId === d.id} key={d.id} onClick={() => setDrinkId(d.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold border ${drinkId === d.id ? 'bg-cyan-400/15 text-cyan-200 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-800'}`}>{d.variant}</button>
              ))}
              {!group && <p className="text-[11px] text-gray-400">Escolha o tipo acima.</p>}
            </div>
            <div>
              <label htmlFor="mb-ml" className="block text-[11px] font-bold text-gray-400 mb-1">Quantos ml?</label>
              <input id="mb-ml" inputMode="decimal" value={ml} onChange={(e) => setMl(e.target.value)} placeholder="Ex.: 350" className={`${inputCls} w-full`} />
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Volumes comuns">
                {ML_CHIPS.map((v) => <button type="button" key={v} onClick={() => setMl(String(v))} className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border ${Number(ml) === v ? 'bg-cyan-400 text-slate-950 border-cyan-400' : 'bg-[#0B0F17] text-gray-300 border-gray-700'}`}>{v} ml</button>)}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Copo comum: ~200 ml. Lata: 350 ml. Garrafinha: 500 ml.</p>
            </div>
            <div>
              <label htmlFor="mb-label" className="block text-[11px] font-bold text-gray-400 mb-1">Tem rótulo? kcal por 100 ml (opcional)</label>
              <input id="mb-label" inputMode="decimal" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: 42" className={`${inputCls} w-full`} />
            </div>
          </>
        )}

        {needGrams.length > 0 && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">Informe os gramas de: {needGrams.join(', ')}.</p>}
        {preview && (
          <div className="rounded-xl border border-gray-800 bg-[#0B0F17] p-3 text-center" aria-live="polite">
            <p className="text-[10px] text-gray-400">Estimativa pela tabela TACO • {Math.round(preview.total_g)} {mode === 'bebida' ? 'ml' : 'g'}</p>
            <b className="text-xl text-emerald-400">{Math.round(preview.total_calories)} kcal</b>
            <p className="text-[11px] text-gray-300">Proteína {Math.round(preview.total_protein_g)} g • Carbo {Math.round(preview.total_carbs_g)} g • Gordura {Math.round(preview.total_fat_g)} g</p>
            {preview.estimated && preview.reasons && <p className="text-[10px] text-amber-300 mt-1">Estimativa: {preview.reasons.join('; ')}.</p>}
            {hasFree && <p className="text-[10px] text-amber-300 mt-1">Itens fora da tabela entram no registro com estimativa da IA.</p>}
          </div>
        )}
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        <button onClick={save} disabled={!canSave} className="w-full py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-black text-sm">{busy ? 'Registrando...' : 'Registrar refeição'}</button>
        <p className="text-[10px] text-gray-500 text-center">A foto já foi descontada uma vez e não é guardada. Mudar itens, gramas e complemento não gasta mais nada.</p>
      </div>
    </Modal>
  );
}
