"use client";

import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'diario' | 'metas' | 'planos'>('diario');
  const [selectedDay, setSelectedDay] = useState('Seg');
  
  // Hidratação
  const [waterGoal, setWaterGoal] = useState(2800);
  const [waterDrunk, setWaterDrunk] = useState(1300);
  const [customMl, setCustomMl] = useState(200);
  const [waterAlarmEnabled, setWaterAlarmEnabled] = useState(true);
  const [waterInterval, setWaterInterval] = useState('1h30');

  // Balanço Energético
  const [caloriesConsumed, setCaloriesConsumed] = useState(640);
  const [caloriesBurned, setCaloriesBurned] = useState(380);
  const dailyCalorieGoal = 2100;

  // Grade de Refeições com Horários Editáveis
  const [mealsSchedule, setMealsSchedule] = useState([
    { id: 1, name: 'Café da Manhã', time: '08:00', enabled: true },
    { id: 2, name: 'Almoço', time: '12:30', enabled: true },
    { id: 3, name: 'Lanche da Tarde', time: '16:00', enabled: false },
    { id: 4, name: 'Jantar', time: '20:00', enabled: true },
  ]);

  // Rotina Semanal de Treinos (Piloto Automático)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Record<string, Array<{ id: number; activity: string; time: string; duration: number; completed: boolean; burned: number }>>>({
    'Seg': [{ id: 1, activity: 'Musculação Hipertrofia', time: '18:30', duration: 45, completed: true, burned: 240 }],
    'Ter': [{ id: 2, activity: 'Caminhada Rápida', time: '07:00', duration: 30, completed: false, burned: 140 }],
    'Qua': [{ id: 3, activity: 'Musculação Hipertrofia', time: '18:30', duration: 45, completed: false, burned: 240 }],
    'Qui': [{ id: 4, activity: 'Caminhada Rápida', time: '07:00', duration: 30, completed: false, burned: 140 }],
    'Sex': [{ id: 5, activity: 'Musculação Hipertrofia', time: '18:30', duration: 45, completed: false, burned: 240 }],
    'Sáb': [{ id: 6, activity: 'Corrida ao Ar Livre', time: '08:00', duration: 40, completed: false, burned: 350 }],
    'Dom': [],
  });

  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Form de inclusão no dia selecionado
  const [newActivity, setNewActivity] = useState('caminhada');
  const [newTime, setNewTime] = useState('07:00');
  const [newDuration, setNewDuration] = useState(30);

  // Metas
  const [currentWeight, setCurrentWeight] = useState(80);
  const [targetWeight, setTargetWeight] = useState(74);
  const [height, setHeight] = useState(175);
  const [age, setAge] = useState(32);
  const [activityLevel, setActivityLevel] = useState('Moderado (3 a 5 treinos por semana)');
  const [calculatedPlan, setCalculatedPlan] = useState<string | null>(null);

  const handleAddWater = (amount: number) => {
    if (amount <= 0) return;
    setWaterDrunk((prev) => prev + amount);
  };

  const handleMealTimeChange = (id: number, newTime: string) => {
    setMealsSchedule((prev) => prev.map((m) => m.id === id ? { ...m, time: newTime } : m));
  };

  const toggleMealAlarm = (id: number) => {
    setMealsSchedule((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const toggleWorkoutCompleted = (day: string, id: number) => {
    setWeeklyWorkouts((prev) => {
      const list = prev[day] || [];
      const updated = list.map((w) => {
        if (w.id === id) {
          const nextCompleted = !w.completed;
          setCaloriesBurned((c) => nextCompleted ? c + w.burned : Math.max(0, c - w.burned));
          return { ...w, completed: nextCompleted };
        }
        return w;
      });
      return { ...prev, [day]: updated };
    });
  };

  const handleAddWeeklyWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    let rate = 5;
    if (newActivity === 'caminhada') rate = 4;
    if (newActivity === 'corrida') rate = 10;
    if (newActivity === 'musculacao') rate = 6;
    if (newActivity === 'bicicleta') rate = 8;
    const est = newDuration * rate;

    const newItem = {
      id: Date.now(),
      activity: newActivity.charAt(0).toUpperCase() + newActivity.slice(1),
      time: newTime,
      duration: Number(newDuration),
      completed: false,
      burned: est,
    };

    setWeeklyWorkouts((prev) => ({
      ...prev,
      [selectedDay]: [...(prev[selectedDay] || []), newItem],
    }));
  };

  const netCalories = caloriesConsumed - caloriesBurned;
  const remainingCalories = dailyCalorieGoal - netCalories;
  const remainingWater = Math.max(0, waterGoal - waterDrunk);
  const waterPercentage = Math.min(Math.round((waterDrunk / waterGoal) * 100), 100);

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
            <p className="text-[11px] text-gray-400 font-medium">5 dias na ofensiva • Plano Starter</p>
          </div>
          <button 
            onClick={() => setActiveTab('planos')}
            className="px-3.5 py-1.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-400/25 transition active:scale-95"
          >
            Upgrade Pro
          </button>
        </header>

        {/* Scroll Content */}
        <main className="flex-1 overflow-y-auto px-5 py-5 pb-28 space-y-4">
          
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
                      {Math.round((netCalories / dailyCalorieGoal) * 100)}%
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
                    <p className="text-sm font-black text-rose-400 mt-0.5">-{caloriesBurned} kcal</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-800/60">
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Proteínas</span>
                    <p className="text-xs font-black text-cyan-400">48g / 160g</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Carbos</span>
                    <p className="text-xs font-black text-blue-400">62g / 210g</p>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-gray-400">Gorduras</span>
                    <p className="text-xs font-black text-amber-400">18g / 65g</p>
                  </div>
                </div>
              </div>

              {/* CARD 2: BOTÃO ESCANEAR PRATO */}
              <button 
                onClick={() => alert('Abra a câmera ou selecione uma foto de prato/bebida!')}
                className="w-full py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm shadow-xl shadow-cyan-400/25 transition active:scale-98 flex items-center justify-center gap-2"
              >
                <span>📷</span>
                <span>Escanear Prato por Foto</span>
              </button>

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
                        onChange={() => setWaterAlarmEnabled(!waterAlarmEnabled)}
                        className="accent-cyan-400 rounded w-4 h-4 cursor-pointer" 
                      />
                      <span className="text-xs font-bold text-white">Alarme Inteligente de Água</span>
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
                    <p className="text-[10px] text-gray-400 mt-0.5">Clique no horário sugerido para alterar</p>
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
                        {meal.enabled ? 'Alarme ON' : 'Desativado'}
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
                          <p className={`text-xs font-bold ${w.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                            {w.activity} ({w.duration} min)
                          </p>
                          <span className="text-[10px] text-cyan-400 font-medium">{w.time} • Queima: ~{w.burned} kcal</span>
                        </div>
                        <button
                          onClick={() => toggleWorkoutCompleted(selectedDay, w.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                            w.completed
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                          }`}
                        >
                          {w.completed ? '✓ Feito' : 'Concluir'}
                        </button>
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
                O nosso motor calcula automaticamente as suas calorias e macronutrientes.
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
                  onClick={() => setCalculatedPlan('Plano atualizado! Meta diária: 2.100 kcal.')}
                  className="w-full mt-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-400/20 transition active:scale-98"
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

          {/* ABA 3: PLANOS E CRÉDITOS */}
          {activeTab === 'planos' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center">
                <h2 className="text-sm font-bold text-white">Planos NutriSnap IA</h2>
                <p className="text-[11px] text-gray-400">Direto no Pix ou Cartão com ativação imediata</p>
              </div>
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-cyan-400">Asaas / Pix</span>
                  <h3 className="text-xs font-bold text-white mt-0.5">Pacote Essencial</h3>
                  <p className="text-2xl font-black text-white mt-1">R$ 25,90</p>
                  <p className="text-[11px] text-cyan-400 font-semibold">60 fotos por mês</p>
                </div>
                <a href="https://www.asaas.com/c/SEU_LINK_ASAAS_BASICO" className="mt-3 block text-center py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs transition">
                  Assinar Essencial
                </a>
              </div>
              <div className="bg-[#141B2D] border-2 border-cyan-400 rounded-2xl p-4 flex flex-col justify-between relative shadow-lg shadow-cyan-400/10">
                <span className="absolute -top-2.5 right-4 bg-cyan-400 text-slate-950 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Mais Popular
                </span>
                <div>
                  <span className="text-[9px] uppercase font-bold text-cyan-300">Recomendado</span>
                  <h3 className="text-xs font-bold text-white mt-0.5">Pacote Pro</h3>
                  <p className="text-2xl font-black text-cyan-400 mt-1">R$ 49,90</p>
                  <p className="text-[11px] text-cyan-300 font-semibold">150 fotos por mês</p>
                </div>
                <a href="https://www.asaas.com/c/SEU_LINK_ASAAS_PRO" className="mt-3 block text-center py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition shadow-md shadow-cyan-400/20">
                  Assinar Pacote Pro
                </a>
              </div>
              <div className="bg-[#141B2D] border border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-amber-400">Performance</span>
                  <h3 className="text-xs font-bold text-white mt-0.5">Pacote Power</h3>
                  <p className="text-2xl font-black text-amber-400 mt-1">R$ 79,90</p>
                  <p className="text-[11px] text-amber-300 font-semibold">300 fotos por mês</p>
                </div>
                <a href="https://www.asaas.com/c/SEU_LINK_ASAAS_POWER" className="mt-3 block text-center py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition">
                  Assinar Power
                </a>
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
