"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getToken, setToken, todayKey, todayWeekday, Usage } from '@/lib/api';
import { analyzeMealPhoto, AnalyzeResponse } from '@/features/meal-scanner/mealScannerService';
import { PLANS, SUPPORT_EMAIL } from '@/lib/plans';
import AuthScreen from '@/components/AuthScreen';

type Workout = { id: number; activity: string; time: string; duration: number; burned: number };
type MealRow = { id: string; meal_type: string; name: string; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number };
type Goals = { calorie_target: number; protein_target_g: number; carb_target_g: number; fat_target_g: number; water_goal_ml: number };
type Schedule = { id: number; name: string; time: string; enabled: boolean };
type User = { id: string; email: string; name: string };

const DEFAULT_GOALS: Goals = { calorie_target: 2000, protein_target_g: 120, carb_target_g: 250, fat_target_g: 65, water_goal_ml: 2500 };
const DEFAULT_SCHEDULE: Schedule[] = [
  { id: 1, name: 'Café da Manhã', time: '08:00', enabled: false },
  { id: 2, name: 'Almoço', time: '12:30', enabled: false },
  { id: 3, name: 'Lanche da Tarde', time: '16:00', enabled: false },
  { id: 4, name: 'Jantar', time: '20:00', enabled: false },
];
const ACTIVITY: Record<string, string> = { 'Sedentário': 'sedentary', 'Leve': 'light', 'Moderado (3 a 5 treinos por semana)': 'moderate', 'Intenso': 'intense' };
const MEAL_LABEL: Record<string, string> = { cafe: 'Café', almoco: 'Almoço', lanche: 'Lanche', jantar: 'Jantar', outro: 'Refeição' };
const INTERVAL_MIN: Record<string, number> = { '45min': 45, '1h': 60, '1h30': 90, '2h': 120 };
const RATE: Record<string, number> = { caminhada: 4, corrida: 11, musculacao: 6, bicicleta: 8 };

function prune<T>(o: Record<string, T>, keep = 60): Record<string, T> {
  const keys = Object.keys(o).sort().slice(-keep);
  return Object.fromEntries(keys.map((k) => [k, o[k]]));
}
function nowSP(): { hhmm: string; hour: number } {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return { hhmm: p, hour: Number(p.slice(0, 2)) };
}

function AppShell({ user, usage, setUsage, onLogout }: { user: User; usage: Usage; setUsage: (u: Usage) => void; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'diario' | 'metas' | 'planos'>('diario');
  const [selectedDay, setSelectedDay] = useState(todayWeekday());
  const [loaded, setLoaded] = useState(false);
  const today = todayKey();

  // Estado pessoal (salvo na conta)
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [water, setWater] = useState<Record<string, number>>({});
  const [doneLog, setDoneLog] = useState<Record<string, number[]>>({});
  const [waterAlarmEnabled, setWaterAlarmEnabled] = useState(false);
  const [waterInterval, setWaterInterval] = useState('1h30');
  const [mealsSchedule, setMealsSchedule] = useState<Schedule[]>(DEFAULT_SCHEDULE);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Record<string, Workout[]>>({});
  const [currentWeight, setCurrentWeight] = useState(70);
  const [targetWeight, setTargetWeight] = useState(65);
  const [height, setHeight] = useState(170);
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState('female');
  const [activityLevel, setActivityLevel] = useState('Leve');

  const [customMl, setCustomMl] = useState(200);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [newActivity, setNewActivity] = useState('caminhada');
  const [newTime, setNewTime] = useState('07:00');
  const [newDuration, setNewDuration] = useState(30);
  const [calculatedPlan, setCalculatedPlan] = useState<string | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const [saveError, setSaveError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<AnalyzeResponse | null>(null);
  const [scanError, setScanError] = useState('');
  const [accountMsg, setAccountMsg] = useState('');
  const [delPassword, setDelPassword] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) { onLogout(); return true; }
    return false;
  }, [onLogout]);

  const loadMeals = useCallback(async () => {
    try {
      const r = await api<{ meals: MealRow[] }>(`/meals?date=${todayKey()}`);
      setMeals(r.meals);
    } catch (e) { handleAuthError(e); }
  }, [handleAuthError]);

  // Carrega estado e diário
  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ data: any }>('/state');
        const d = r.data || {};
        if (d.goals) setGoals(d.goals);
        if (d.water) setWater(d.water);
        if (d.doneLog) setDoneLog(d.doneLog);
        if (typeof d.waterAlarm === 'boolean') setWaterAlarmEnabled(d.waterAlarm);
        if (d.waterInterval) setWaterInterval(d.waterInterval);
        if (d.mealsSchedule) setMealsSchedule(d.mealsSchedule);
        if (d.weeklyWorkouts) setWeeklyWorkouts(d.weeklyWorkouts);
        if (d.profile) {
          setCurrentWeight(d.profile.weight); setTargetWeight(d.profile.target); setHeight(d.profile.height);
          setAge(d.profile.age); setGender(d.profile.gender); setActivityLevel(d.profile.activity);
        }
      } catch (e) { handleAuthError(e); }
      await loadMeals();
      setLoaded(true);
    })();
  }, [handleAuthError, loadMeals]);

  // Salva (com pequena espera) sempre que algo muda
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await api('/state', { method: 'PUT', body: {
          goals, water: prune(water), doneLog: prune(doneLog), waterAlarm: waterAlarmEnabled, waterInterval, mealsSchedule, weeklyWorkouts,
          profile: { weight: currentWeight, target: targetWeight, height, age, gender, activity: activityLevel },
        } });
        setSaveError(false);
      } catch (e) { if (!handleAuthError(e)) setSaveError(true); }
    }, 800);
    return () => clearTimeout(t);
  }, [loaded, goals, water, doneLog, waterAlarmEnabled, waterInterval, mealsSchedule, weeklyWorkouts, currentWeight, targetWeight, height, age, gender, activityLevel, handleAuthError]);

  // Lembretes (funcionam com o app aberto; usam notificação do navegador quando permitida)
  const fired = useRef<Set<string>>(new Set());
  const lastWaterPing = useRef<number>(Date.now());
  const waterNow = water[today] || 0;
  useEffect(() => {
    const notify = (msg: string) => {
      setBanner(msg);
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('NutriSnap IA', { body: msg }); } catch { /* sem suporte */ }
    };
    const tick = () => {
      const { hhmm, hour } = nowSP();
      mealsSchedule.forEach((m) => {
        const key = `${todayKey()}-${m.id}-${m.time}`;
        if (m.enabled && m.time === hhmm && !fired.current.has(key)) { fired.current.add(key); notify(`Hora do ${m.name}! Fotografe o prato.`); }
      });
      if (waterAlarmEnabled && hour >= 7 && hour < 22 && waterNow < goals.water_goal_ml &&
          Date.now() - lastWaterPing.current >= (INTERVAL_MIN[waterInterval] || 90) * 60000) {
        lastWaterPing.current = Date.now(); notify('Hora de beber água 💧');
      }
    };
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, [mealsSchedule, waterAlarmEnabled, waterInterval, waterNow, goals.water_goal_ml]);

  const askNotifyPermission = () => {
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission(); } catch { /* sem suporte */ }
  };

  const handleAddWater = (amount: number) => {
    if (!(amount > 0) || amount > 3000) return;
    lastWaterPing.current = Date.now();
    setWater((prev) => ({ ...prev, [today]: (prev[today] || 0) + Math.round(amount) }));
  };

  const handleMealTimeChange = (id: number, newTime: string) => {
    setMealsSchedule((prev) => prev.map((m) => (m.id === id ? { ...m, time: newTime } : m)));
  };
  const toggleMealAlarm = (id: number) => {
    askNotifyPermission();
    setMealsSchedule((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
  };

  const isToday = (day: string) => day === todayWeekday();
  const isDone = (day: string, id: number) => isToday(day) && (doneLog[today] || []).includes(id);
  const toggleWorkoutCompleted = (day: string, id: number) => {
    if (!isToday(day)) return;
    setDoneLog((prev) => {
      const cur = prev[today] || [];
      return { ...prev, [today]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  };
  const handleAddWeeklyWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const dur = Math.round(Number(newDuration));
    if (!(dur >= 1 && dur <= 600)) return;
    const item: Workout = {
      id: Date.now(),
      activity: newActivity.charAt(0).toUpperCase() + newActivity.slice(1),
      time: newTime, duration: dur, burned: dur * (RATE[newActivity] || 5),
    };
    setWeeklyWorkouts((prev) => ({ ...prev, [selectedDay]: [...(prev[selectedDay] || []), item] }));
  };
  const removeWorkout = (day: string, id: number) => {
    setWeeklyWorkouts((prev) => ({ ...prev, [day]: (prev[day] || []).filter((w) => w.id !== id) }));
  };

  const handleCalc = async () => {
    setCalcBusy(true); setCalculatedPlan(null);
    try {
      const r = await api<{ data: Goals & { tdee: number } }>('/nutrition/calculate', { method: 'POST', body: {
        weight_kg: Number(currentWeight), target_weight_kg: Number(targetWeight), height_cm: Number(height), age: Number(age),
        gender, activity_level: ACTIVITY[activityLevel] || 'sedentary',
      } });
      setGoals(r.data);
      setCalculatedPlan(`Plano atualizado! Meta diária: ${r.data.calorie_target} kcal • Proteína ${r.data.protein_target_g} g • Carbo ${r.data.carb_target_g} g • Gordura ${r.data.fat_target_g} g • Água ${r.data.water_goal_ml} ml. Estimativa geral; para acompanhamento individual, procure um nutricionista.`);
    } catch (e: any) { if (!handleAuthError(e)) setCalculatedPlan(e.message); }
    finally { setCalcBusy(false); }
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setScanError(''); setLastScan(null); setScanning(true);
    try {
      const r = await analyzeMealPhoto(f);
      setLastScan(r); setUsage(r.usage); await loadMeals();
    } catch (err: any) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 402) { if (err.data?.usage) setUsage(err.data.usage); setActiveTab('planos'); }
      setScanError(err.message || 'Não foi possível analisar a foto.');
    } finally { setScanning(false); }
  };

  const deleteMeal = async (id: string) => {
    try { await api(`/meals/${id}`, { method: 'DELETE' }); await loadMeals(); } catch (e) { handleAuthError(e); }
  };

  const exportData = async () => {
    setAccountMsg('');
    try {
      const d = await api('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'meus-dados-nutrisnap.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { if (!handleAuthError(e)) setAccountMsg(e.message); }
  };
  const deleteAccount = async () => {
    setAccountMsg('');
    try { await api('/account', { method: 'DELETE', body: { password: delPassword } }); setToken(null); onLogout(); }
    catch (e: any) { if (!handleAuthError(e)) setAccountMsg(e.message); }
  };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch { /* segue */ } onLogout(); };

  // Derivados
  const waterGoal = goals.water_goal_ml;
  const waterDrunk = water[today] || 0;
  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const caloriesConsumed = Math.round(meals.reduce((a, m) => a + m.total_calories, 0));
  const protein = Math.round(meals.reduce((a, m) => a + m.total_protein_g, 0));
  const carbs = Math.round(meals.reduce((a, m) => a + m.total_carbs_g, 0));
  const fat = Math.round(meals.reduce((a, m) => a + m.total_fat_g, 0));
  const caloriesBurned = (weeklyWorkouts[todayWeekday()] || []).filter((w) => (doneLog[today] || []).includes(w.id)).reduce((a, w) => a + w.burned, 0);
  const dailyCalorieGoal = goals.calorie_target;
  const netCalories = caloriesConsumed - caloriesBurned;
  const remainingCalories = dailyCalorieGoal - netCalories;
  const remainingWater = Math.max(0, waterGoal - waterDrunk);
  const waterPercentage = Math.min(Math.round((waterDrunk / waterGoal) * 100), 100);
  const planLabel = usage.plan === 'teste' ? 'Teste grátis' : `Plano ${usage.plan.charAt(0).toUpperCase()}${usage.plan.slice(1)}`;
  const noPhotos = usage.remaining <= 0;
  const customerSince = user.name ? user.name.split(' ')[0] : '';

  return (
    <div className="min-h-screen bg-[#070A0F] text-gray-100 flex items-center justify-center py-6 px-3 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="w-full max-w-[430px] bg-[#0E131F] border border-cyan-500/20 rounded-[36px] shadow-[0_0_50px_-10px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col min-h-[920px] relative">
        
        {/* Header */}
        <header className="px-6 pt-7 pb-4 bg-[#0E131F]/90 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center border-b border-gray-800/60">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span>Nutri<span className="text-cyan-400">Snap</span></span>
              <span className="text-[10px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded font-extrabold uppercase">IA</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">{customerSince ? `Olá, ${customerSince} • ` : ''}{planLabel} • {usage.remaining} foto(s) restante(s){usage.plan !== 'teste' && usage.canceled ? ' • não renova' : ''}</p>
          </div>
          {usage.plan === 'teste' && (
            <button
              onClick={() => setActiveTab('planos')}
              className="px-3.5 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-400/25 transition active:scale-95"
            >
              Assinar
            </button>
          )}
        </header>

        {/* Scroll Content */}
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-28 space-y-4">
          {banner && (
            <div role="status" className="flex items-center justify-between gap-2 bg-cyan-500/10 border border-cyan-400/40 text-cyan-200 text-xs rounded-xl p-3">
              <span>{banner}</span>
              <button onClick={() => setBanner('')} aria-label="Fechar aviso" className="text-cyan-400 font-black px-2">✕</button>
            </div>
          )}
          {saveError && <p role="alert" className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">Não foi possível salvar suas alterações agora. Elas serão enviadas quando a conexão voltar.</p>}
          
          {activeTab === 'diario' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* CARD 1: BALANÇO ENERGÉTICO */}
              <div className="bg-[#141B2D] border border-cyan-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Saldo Líquido Diário</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">{netCalories}</span>
                      <span className="text-xs text-gray-400 font-medium">kcal líquidas</span>
                    </div>
                    <p className="text-[11px] text-cyan-400 font-semibold mt-1">
                      Resta para a meta: {remainingCalories} kcal
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-cyan-400/20 border-t-cyan-400 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-cyan-400">
                      {Math.max(0, Math.round((netCalories / dailyCalorieGoal) * 100))}%
                    </span>
                    <span className="text-[8px] text-gray-400 font-bold uppercase">meta</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-800">
                  <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-emerald-500/30">
                    <span className="text-[10px] text-gray-400 block">🍽️ Ingeridas</span>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">+{caloriesConsumed} kcal</p>
                  </div>
                  <div className="bg-[#0B0F17] p-2.5 rounded-xl border border-rose-500/30">
                    <span className="text-[10px] text-gray-400 block">🔥 Queimadas</span>
                    <p className="text-sm font-black text-rose-400 mt-0.5">{caloriesBurned > 0 ? '-' : ''}{caloriesBurned} kcal</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-800/60">
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Proteínas</span>
                    <p className="text-xs font-black text-cyan-400">{protein}g / {goals.protein_target_g}g</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Carbos</span>
                    <p className="text-xs font-black text-blue-400">{carbs}g / {goals.carb_target_g}g</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Gorduras</span>
                    <p className="text-xs font-black text-amber-400">{fat}g / {goals.fat_target_g}g</p>
                  </div>
                </div>
              </div>

              {/* CARD 2: ESCANEAR PRATO */}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} aria-label="Foto do prato" />
              {noPhotos ? (
                <button onClick={() => setActiveTab('planos')} className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-xl transition">
                  Suas fotos acabaram — ver planos
                </button>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={scanning}
                  className="w-full py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-black text-sm shadow-xl shadow-cyan-400/25 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>📷</span>
                  <span>{scanning ? 'Analisando seu prato...' : 'Escanear Prato por Foto'}</span>
                </button>
              )}
              {scanError && <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{scanError}</p>}
              {lastScan && (
                <div className="bg-[#141B2D] border border-emerald-500/40 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-emerald-400">Prato analisado</p>
                      <h3 className="text-sm font-black text-white">{lastScan.data.meal_summary.name}</h3>
                    </div>
                    <span className="text-lg font-black text-emerald-400 whitespace-nowrap">{Math.round(lastScan.data.meal_summary.total_calories)} kcal</span>
                  </div>
                  <p className="text-[11px] text-gray-300">Proteína {Math.round(lastScan.data.meal_summary.total_protein_g)} g • Carbo {Math.round(lastScan.data.meal_summary.total_carbs_g)} g • Gordura {Math.round(lastScan.data.meal_summary.total_fat_g)} g</p>
                  <ul className="text-[11px] text-gray-400 space-y-0.5">
                    {lastScan.data.items.map((it, i) => (<li key={i}>• {it.name} (~{Math.round(it.estimated_weight_g)} g) — {Math.round(it.calories)} kcal</li>))}
                  </ul>
                  {lastScan.data.meal_summary.notes && <p className="text-[11px] text-gray-400 italic">{lastScan.data.meal_summary.notes}</p>}
                  <p className="text-[10px] text-gray-500">Confiança: {lastScan.data.meal_summary.confidence_level || '—'}. Estimativa aproximada feita por IA; a foto não é guardada.</p>
                </div>
              )}

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-white">Refeições de hoje</h3>
                {meals.length === 0 ? (
                  <p className="text-[11px] text-gray-400">Nenhuma refeição ainda. Fotografe seu prato para começar o diário.</p>
                ) : meals.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0B0F17] border border-gray-800/80">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{MEAL_LABEL[m.meal_type] || 'Refeição'} • {m.name || 'Prato'}</p>
                      <span className="text-[10px] text-gray-400">{Math.round(m.total_calories)} kcal • P {Math.round(m.total_protein_g)}g • C {Math.round(m.total_carbs_g)}g • G {Math.round(m.total_fat_g)}g</span>
                    </div>
                    <button onClick={() => deleteMeal(m.id)} aria-label={`Remover ${m.name || 'refeição'}`} className="text-rose-400 hover:text-rose-300 text-xs font-black px-2 py-1">✕</button>
                  </div>
                ))}
              </div>

              {/* CARD 3: HIDRATAÇÃO COMPLETA */}
              <div className="bg-[#141B2D] border border-cyan-500/30 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💧</span>
                      <h3 className="text-xs font-bold text-white">Meta Diária de Líquidos</h3>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-2xl font-black text-cyan-400">{waterDrunk}</span>
                      <span className="text-xs text-gray-400 font-bold">/ {waterGoal} ml</span>
                    </div>
                    <p className="text-[11px] font-medium text-emerald-400 mt-0.5">
                      {remainingWater === 0 ? '✓ Meta diária batida!' : `Faltam ${remainingWater} ml para a meta`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      {waterPercentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                    style={{ width: `${waterPercentage}%` }}
                  ></div>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block mb-2">Registrar Consumo:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAddWater(150)}
                      className="py-2 rounded-xl bg-[#0B0F17] hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 text-xs font-black transition active:scale-95"
                    >
                      +150 ml <span className="block text-[8px] text-gray-400 font-normal">Xícara/Copo</span>
                    </button>
                    <button
                      onClick={() => handleAddWater(250)}
                      className="py-2 rounded-xl bg-[#0B0F17] hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 text-xs font-black transition active:scale-95"
                    >
                      +250 ml <span className="block text-[8px] text-gray-400 font-normal">Copo Padrão</span>
                    </button>
                    <button
                      onClick={() => handleAddWater(500)}
                      className="py-2 rounded-xl bg-[#0B0F17] hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 text-xs font-black transition active:scale-95"
                    >
                      +500 ml <span className="block text-[8px] text-gray-400 font-normal">Squeeze</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 items-center pt-1">
                  <input
                    type="number"
                    value={customMl}
                    onChange={(e) => setCustomMl(Number(e.target.value))}
                    step="50"
                    min="50"
                    max="1500"
                    className="flex-1 bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    placeholder="Outro valor em ml"
                  />
                  <button
                    onClick={() => handleAddWater(Number(customMl))}
                    className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition active:scale-95"
                  >
                    + Registrar ml
                  </button>
                </div>

                <div className="pt-3 border-t border-gray-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={waterAlarmEnabled} 
                        onChange={() => { askNotifyPermission(); setWaterAlarmEnabled(!waterAlarmEnabled); }}
                        className="accent-cyan-400 rounded w-4 h-4 cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-white">Lembrete de Água</span>
                    </label>
                    <select
                      value={waterInterval}
                      onChange={(e) => setWaterInterval(e.target.value)}
                      disabled={!waterAlarmEnabled}
                      className="bg-[#0B0F17] border border-gray-800 rounded-lg px-2 py-1 text-[11px] text-cyan-400 font-bold focus:outline-none disabled:opacity-40"
                    >
                      <option value="45min">A cada 45 min</option>
                      <option value="1h">A cada 1h</option>
                      <option value="1h30">A cada 1h30</option>
                      <option value="2h">A cada 2h</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD 4: ALARMES DE REFEIÇÕES COM HORÁRIOS CONFIGURÁVEIS */}
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>⏰</span> Grade Diária de Refeições
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Lembretes tocam com o app aberto. Toque no horário para alterar.</p>
                  </div>
                  <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                    Editável
                  </span>
                </div>
                <div className="space-y-2 pt-1">
                  {mealsSchedule.map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F17] border border-gray-800/80">
                      <div>
                        <p className="text-xs font-bold text-white">{meal.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-gray-400">Horário:</span>
                          <input 
                            type="time" 
                            value={meal.time} 
                            onChange={(e) => handleMealTimeChange(meal.id, e.target.value)}
                            className="bg-transparent text-cyan-400 font-bold text-xs focus:outline-none border-b border-cyan-500/40"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleMealAlarm(meal.id)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition ${
                          meal.enabled 
                            ? 'bg-cyan-400 text-slate-950' 
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {meal.enabled ? 'Lembrete ON' : 'Desativado'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD 5: AGENDA SEMANAL DE TREINOS COM SELETOR DE DIAS */}
              <div className="bg-[#141B2D] border border-cyan-500/30 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🏃‍♂️</span> Agenda Semanal de Treinos
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Configure sua semana uma vez e entre na rotina</p>
                  </div>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Semanal
                  </span>
                </div>

                {/* Seletor dos Dias da Semana */}
                <div className="flex justify-between gap-1 bg-[#0B0F17] p-1 rounded-xl border border-gray-800">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition ${
                        selectedDay === day 
                          ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Lista de Atividades do Dia Selecionado */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] text-gray-400 font-bold px-1">
                    <span>Programação de {selectedDay}:</span>
                    <span>{(weeklyWorkouts[selectedDay] || []).length} atividade(s)</span>
                  </div>

                  {(!weeklyWorkouts[selectedDay] || weeklyWorkouts[selectedDay].length === 0) ? (
                    <div className="p-4 rounded-xl bg-[#0B0F17] text-center border border-gray-800/60">
                      <p className="text-xs text-gray-400">Dia de descanso programado ou sem treinos 🛌</p>
                    </div>
                  ) : (
                    weeklyWorkouts[selectedDay].map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0F17] border border-gray-800/80">
                        <div>
                          <p className={`text-xs font-bold ${isDone(selectedDay, w.id) ? 'line-through text-gray-500' : 'text-white'}`}>
                            {w.activity} ({w.duration} min)
                          </p>
                          <span className="text-[10px] text-cyan-400 font-medium">{w.time} • Queima: ~{w.burned} kcal</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleWorkoutCompleted(selectedDay, w.id)}
                            disabled={!isToday(selectedDay)}
                            title={isToday(selectedDay) ? '' : 'Só dá para concluir no próprio dia'}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition disabled:opacity-40 ${
                              isDone(selectedDay, w.id)
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                            }`}
                          >
                            {isDone(selectedDay, w.id) ? '✓ Feito' : isToday(selectedDay) ? 'Concluir' : 'Agendado'}
                          </button>
                          <button onClick={() => removeWorkout(selectedDay, w.id)} aria-label={`Remover ${w.activity}`} className="text-rose-400 hover:text-rose-300 text-xs font-black px-1.5">✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Adicionar Atividade no Dia Selecionado */}
                <form onSubmit={handleAddWeeklyWorkout} className="pt-2 border-t border-gray-800 space-y-2">
                  <span className="text-[10px] text-gray-400 font-bold block">Adicionar treino para {selectedDay}:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      className="bg-[#0B0F17] border border-gray-800 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="caminhada">Caminhada</option>
                      <option value="corrida">Corrida</option>
                      <option value="musculacao">Musculação</option>
                      <option value="bicicleta">Bicicleta</option>
                    </select>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="bg-[#0B0F17] border border-gray-800 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-400"
                    />
                    <input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      min={1} max={600}
                      aria-label="Duração em minutos"
                      placeholder="Min"
                      className="bg-[#0B0F17] border border-gray-800 rounded-xl px-2 py-2 text-[11px] text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs border border-gray-700 transition"
                  >
                    + Salvar na Rotina de {selectedDay}
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* ABA 2: PESO E METAS */}
          {activeTab === 'metas' && (
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold text-white">Configurar Peso e Objetivo</h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Calculamos suas calorias, macros e água com a fórmula de Mifflin-St Jeor. É uma estimativa geral, não substitui avaliação profissional.
              </p>
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Peso Atual (kg)</label>
                    <input 
                      type="number" 
                      value={currentWeight}
                      onChange={(e) => setCurrentWeight(Number(e.target.value))}
                      className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Peso Objetivo (kg)</label>
                    <input 
                      type="number" 
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(Number(e.target.value))}
                      className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Altura (cm)</label>
                    <input 
                      type="number" 
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">Idade</label>
                    <input 
                      type="number" 
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Sexo biológico (usado na fórmula)</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white">
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Nível de Atividade</label>
                  <select 
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                    className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Sedentário">Sedentário</option>
                    <option value="Leve">Leve (1 a 3 dias/semana)</option>
                    <option value="Moderado (3 a 5 treinos por semana)">Moderado (3 a 5 treinos/semana)</option>
                    <option value="Intenso">Intenso (6 a 7 dias/semana)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCalc}
                  disabled={calcBusy}
                  className="w-full mt-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 text-slate-950 font-black text-xs shadow-lg shadow-cyan-400/20 transition active:scale-98"
                >
                  Calcular Meu Plano Nutricional
                </button>
                {calculatedPlan && (
                  <p className="text-[11px] text-cyan-400 text-center font-medium bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20">
                    {calculatedPlan}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: PLANOS E CONTA */}
          {activeTab === 'planos' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center">
                <h2 className="text-sm font-bold text-white">Planos NutriSnap IA</h2>
                <p className="text-[11px] text-gray-400">Pix ou cartão, pelo checkout seguro da Cakto. Assinatura mensal, cancele quando quiser.</p>
                <p className="text-[11px] text-cyan-300 mt-1">Use o e-mail <strong>{user.email}</strong> na compra para liberar seu acesso automaticamente.</p>
              </div>
              {usage.plan !== 'teste' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-[11px] text-emerald-300">
                  Seu plano: <strong>{planLabel}</strong> — {usage.used} de {usage.limit} fotos usadas neste mês{usage.daily_limit > 0 ? ` (máx. ${usage.daily_limit} por dia)` : ''}.
                  {usage.active_until ? ` ${usage.canceled ? 'Acesso até' : 'Renova até'} ${new Date(usage.active_until).toLocaleDateString('pt-BR')}.` : ''}
                </div>
              )}
              {usage.plan === 'teste' && <p className="text-[11px] text-gray-300 text-center">Teste grátis: {usage.remaining} de 3 fotos restantes.</p>}
              {PLANS.map((p) => (
                <div key={p.id} className={`bg-[#141B2D] rounded-2xl p-4 border ${p.id === 'pro' ? 'border-2 border-cyan-400 shadow-lg shadow-cyan-400/10' : p.id === 'power' ? 'border-amber-500/40' : 'border-gray-800'}`}>
                  <h3 className="text-xs font-bold text-white">Pacote {p.name}{usage.plan === p.id ? ' • seu plano' : ''}</h3>
                  <p className={`text-2xl font-black mt-1 ${p.id === 'power' ? 'text-amber-400' : p.id === 'pro' ? 'text-cyan-400' : 'text-white'}`}>{p.price}<span className="text-[11px] text-gray-400 font-medium"> /mês</span></p>
                  <p className="text-[11px] text-cyan-300 font-semibold">{p.photos} fotos por mês{p.daily ? ` • até ${p.daily} por dia` : ''}</p>
                  <a href={p.link} target="_blank" rel="noopener noreferrer"
                    className={`mt-3 block text-center py-2.5 rounded-xl font-black text-xs transition ${p.id === 'pro' ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950' : p.id === 'power' ? 'bg-amber-400 hover:bg-amber-300 text-slate-950' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
                    {usage.plan === p.id ? 'Renovar / gerenciar' : `Assinar ${p.name}`}
                  </a>
                </div>
              ))}
              <p className="text-[10px] text-gray-500 text-center">Após o pagamento aprovado, o plano é liberado em instantes. Se não aparecer em alguns minutos, fale com {SUPPORT_EMAIL}.</p>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white">Minha conta</h3>
                <p className="text-[11px] text-gray-400">{user.email}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportData} className="py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-bold">Baixar meus dados</button>
                  <button onClick={logout} className="py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-bold">Sair</button>
                </div>
                {!showDelete ? (
                  <button onClick={() => setShowDelete(true)} className="text-[11px] text-rose-400 underline">Excluir minha conta e meus dados</button>
                ) : (
                  <div className="space-y-2 border border-rose-500/30 rounded-xl p-3">
                    <p className="text-[11px] text-rose-300">Isso apaga sua conta, refeições e metas de forma definitiva. Confirme com sua senha.</p>
                    <input type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} aria-label="Senha para confirmar" placeholder="Sua senha" className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white" />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setShowDelete(false); setDelPassword(''); }} className="py-2 rounded-xl bg-gray-800 text-white text-[11px] font-bold">Cancelar</button>
                      <button onClick={deleteAccount} className="py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-black">Excluir de vez</button>
                    </div>
                  </div>
                )}
                {accountMsg && <p role="alert" className="text-[11px] text-rose-300">{accountMsg}</p>}
                <p className="text-[10px] text-gray-500"><a className="underline" href="/termos/" target="_blank" rel="noopener">Termos de Uso</a> • <a className="underline" href="/privacidade/" target="_blank" rel="noopener">Política de Privacidade</a></p>
              </div>
            </div>
          )}

        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 w-full bg-[#0E131F]/95 backdrop-blur-md border-t border-gray-800/80 py-3 px-6 flex justify-around items-center z-40">
          <button 
            onClick={() => setActiveTab('diario')} 
            className={`text-xs font-bold transition flex flex-col items-center gap-1 ${activeTab === 'diario' ? 'text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span>Diário e IA</span>
          </button>
          <button 
            onClick={() => setActiveTab('metas')} 
            className={`text-xs font-bold transition flex flex-col items-center gap-1 ${activeTab === 'metas' ? 'text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span>Peso e Metas</span>
          </button>
          <button 
            onClick={() => setActiveTab('planos')} 
            className={`text-xs font-bold transition flex flex-col items-center gap-1 ${activeTab === 'planos' ? 'text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span>Planos e Créditos</span>
          </button>
        </nav>

      </div>
    </div>
  );
}


export default function Home() {
  const [state, setState] = useState<'boot' | 'out' | 'in'>('boot');
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const logout = useCallback(() => { setToken(null); setUser(null); setUsage(null); setState('out'); }, []);

  useEffect(() => {
    if (!getToken()) { setState('out'); return; }
    api<{ user: User; usage: Usage }>('/me')
      .then((r) => { setUser(r.user); setUsage(r.usage); setState('in'); })
      .catch(() => { setToken(null); setState('out'); });
  }, []);

  if (state === 'boot') return <div className="min-h-screen bg-[#070A0F] flex items-center justify-center text-xs text-gray-400">Carregando...</div>;
  if (state === 'out' || !user || !usage) {
    return <AuthScreen onSession={(s) => { setUser(s.user); setUsage(s.usage); setState('in'); }} />;
  }
  return <AppShell user={user} usage={usage} setUsage={setUsage} onLogout={logout} />;
}
