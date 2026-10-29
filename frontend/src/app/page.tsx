'use client';

import React, { useState } from 'react';
import { analyzeMealPhoto, MealAnalysisResponse } from '../features/meal-scanner/mealScannerService';

export default function AppNutriDashboard() {
  const [activeTab, setActiveTab] = useState<'diario' | 'metas' | 'planos'>('diario');

  // Estado de Metas Diárias (calculadas pelo TDEE)
  const [targets, setTargets] = useState({
    calorie_target: 2100,
    protein_target_g: 160,
    carb_target_g: 210,
    fat_target_g: 65,
    water_goal_ml: 2800,
  });

  // Estado Consumido no Dia
  const [consumed, setConsumed] = useState({
    calories: 640,
    protein: 48,
    carbs: 62,
    fat: 18,
    water_ml: 1050,
  });

  // Estado de Alertas (Água e Refeições)
  const [waterAlert, setWaterAlert] = useState(true);
  const [mealAlertTime, setMealAlertTime] = useState('12:30');

  // Estado do Scanner de Prato por IA
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanResult, setScanResult] = useState<MealAnalysisResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Estado da Calculadora de Peso/Objetivo (Onboarding TDEE)
  const [bio, setBio] = useState({
    weight_kg: 80,
    target_weight_kg: 74,
    height_cm: 175,
    age: 32,
    gender: 'male',
    activity_level: 'moderate',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingScan(true);
    setScanError(null);
    try {
      const data = await analyzeMealPhoto(file, 'pt-BR');
      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || 'Erro ao analisar foto');
    } finally {
      setLoadingScan(false);
    }
  };

  const handleSaveMealToDiary = () => {
    if (!scanResult) return;
    setConsumed((prev) => ({
      ...prev,
      calories: Math.round(prev.calories + scanResult.meal_summary.total_calories),
      protein: Math.round(prev.protein + scanResult.meal_summary.total_protein_g),
      carbs: Math.round(prev.carbs + scanResult.meal_summary.total_carbs_g),
      fat: Math.round(prev.fat + scanResult.meal_summary.total_fat_g),
    }));
    setScanResult(null);
  };

  const handleCalculateGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
      const res = await fetch(${apiUrl}/nutrition/calculate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bio),
      });
      const json = await res.json();
      if (json.data) {
        setTargets(json.data);
        setActiveTab('diario');
      }
    } catch {
      alert('Servidor Go offline ou inacessível na porta 8080.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-gray-100 flex flex-col items-center pb-24">
      {/* Header */}
      <header className="w-full max-w-md px-5 py-4 flex justify-between items-center border-b border-gray-800/80">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Nutri<span className="text-cyan-400">Lens</span> IA
          </h1>
          <p className="text-xs text-gray-400">🔥 5 dias na ofensiva • Plano Starter</p>
        </div>
        <button
          onClick={() => setActiveTab('planos')}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20"
        >
          ⚡ Upgrade Pro
        </button>
      </header>

      {/* Conteúdo Principal */}
      <main className="w-full max-w-md px-5 pt-5 space-y-5">
        {activeTab === 'diario' && (
          <>
            {/* Card Principal de Calorias & Macros */}
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-gray-400">Calorias Restantes</span>
                  <div className="text-3xl font-extrabold text-cyan-400">
                    {Math.max(0, targets.calorie_target - consumed.calories)} <span className="text-sm font-normal text-gray-400">kcal</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Consumido: {consumed.calories} / Meta: {targets.calorie_target} kcal
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-cyan-400 flex items-center justify-center text-xs font-bold">
                  {Math.min(100, Math.round((consumed.calories / targets.calorie_target) * 100))}%
                </div>
              </div>

              {/* Barras de Macronutrientes */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800">
                <div className="bg-gray-900/70 p-2.5 rounded-xl">
                  <div className="text-xs text-gray-400">Proteínas</div>
                  <div className="text-sm font-bold text-white">{consumed.protein} / {targets.protein_target_g}g</div>
                </div>
                <div className="bg-gray-900/70 p-2.5 rounded-xl">
                  <div className="text-xs text-gray-400">Carbos</div>
                  <div className="text-sm font-bold text-white">{consumed.carbs} / {targets.carb_target_g}g</div>
                </div>
                <div className="bg-gray-900/70 p-2.5 rounded-xl">
                  <div className="text-xs text-gray-400">Gorduras</div>
                  <div className="text-sm font-bold text-white">{consumed.fat} / {targets.fat_target_g}g</div>
                </div>
              </div>
            </div>

            {/* Card de Hidratação e Alarme de Rotina */}
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-white">💧 Hidratação & Alertas</h2>
                  <p className="text-xs text-cyan-400 font-medium">
                    {consumed.water_ml} ml / {targets.water_goal_ml} ml
                  </p>
                </div>
                <button
                  onClick={() => setConsumed((p) => ({ ...p, water_ml: p.water_ml + 250 }))}
                  className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold hover:bg-cyan-500/20"
                >
                  + 250ml Água
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/80">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waterAlert}
                    onChange={(e) => setWaterAlert(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  Alerta de beber água (1h30)
                </label>
                <div className="flex items-center gap-1">
                  <span>Próx. Refeição:</span>
                  <input
                    type="time"
                    value={mealAlertTime}
                    onChange={(e) => setMealAlertTime(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Botão Principal de Escanear Prato (Câmera / Galeria) */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-5 text-center">
              <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25">
                <span>📸 {loadingScan ? 'Analisando Prato com IA...' : 'Escanear Prato por Foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loadingScan}
                />
              </label>
              <p className="text-[11px] text-gray-400 mt-2">
                Compressão WebP ultrarrápida • Gemini 2.0 Vision
              </p>
              {scanError && <p className="text-xs text-red-400 mt-2">{scanError}</p>}
            </div>

            {/* Resultado da Análise da Foto */}
            {scanResult && (
              <div className="bg-[#111827] border border-cyan-500/40 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Confiança: {scanResult.meal_summary.confidence_level}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{scanResult.meal_summary.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-cyan-400">
                      {Math.round(scanResult.meal_summary.total_calories)}
                    </span>
                    <span className="text-xs text-gray-400 block">kcal totais</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {scanResult.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-900/90 p-3 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-gray-400">
                          {item.estimated_weight_g}g • P: {item.protein_g}g | C: {item.carbs_g}g | G: {item.fat_g}g
                        </p>
                      </div>
                      <span className="font-bold text-cyan-300">{Math.round(item.calories)} kcal</span>
                    </div>
                  ))}
                </div>

                {scanResult.meal_summary.notes && (
                  <p className="text-xs text-gray-400 italic bg-gray-900/50 p-2.5 rounded-lg">
                    💡 {scanResult.meal_summary.notes}
                  </p>
                )}

                <button
                  onClick={handleSaveMealToDiary}
                  className="w-full py-3 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm hover:bg-cyan-300"
                >
                  ✅ Registrar no Diário
                </button>
              </div>
            )}
          </>
        )}

        {/* ABA 2: CALCULADORA DE PESO E OBJETIVO (TDEE) */}
        {activeTab === 'metas' && (
          <form onSubmit={handleCalculateGoals} className="bg-[#111827] border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">🎯 Configurar Peso & Objetivo</h2>
            <p className="text-xs text-gray-400">
              Nosso motor calcula automaticamente suas calorias, proteínas (2g/kg) e meta de água diária.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Peso Atual (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={bio.weight_kg}
                  onChange={(e) => setBio({ ...bio, weight_kg: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Peso Objetivo (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={bio.target_weight_kg}
                  onChange={(e) => setBio({ ...bio, target_weight_kg: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-cyan-500/50 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Altura (cm)</label>
                <input
                  type="number"
                  value={bio.height_cm}
                  onChange={(e) => setBio({ ...bio, height_cm: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Idade</label>
                <input
                  type="number"
                  value={bio.age}
                  onChange={(e) => setBio({ ...bio, age: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-gray-400 block mb-1">Nível de Atividade Física</label>
              <select
                value={bio.activity_level}
                onChange={(e) => setBio({ ...bio, activity_level: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white"
              >
                <option value="sedentary">Sedentário (Pouco ou nenhum exercício)</option>
                <option value="light">Leve (1 a 3 treinos por semana)</option>
                <option value="moderate">Moderado (3 a 5 treinos por semana)</option>
                <option value="intense">Intenso (6 a 7 treinos pesados por semana)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold text-sm"
            >
              Calcular Meu Plano Nutricional
            </button>
          </form>
        )}

        {/* ABA 3: OS 3 PLANOS + PACOTE AVULSO */}
        {activeTab === 'planos' && (
          <div className="space-y-4">
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white">Plano Starter (Atual)</h3>
              <p className="text-xl font-extrabold text-gray-300 mt-1">Grátis</p>
              <p className="text-xs text-gray-400 mt-1">• Até 3 análises de prato por dia • Cálculo básico de água e calorias</p>
            </div>

            <div className="bg-[#111827] border-2 border-cyan-400 rounded-2xl p-4 relative">
              <span className="absolute -top-2.5 right-4 bg-cyan-400 text-slate-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                MAIS POPULAR
              </span>
              <h3 className="text-sm font-bold text-white">Plano Pro</h3>
              <p className="text-2xl font-extrabold text-cyan-400 mt-1">R$ 19,90<span className="text-xs text-gray-400">/mês</span></p>
              <p className="text-xs text-gray-300 mt-1">• Fotos ilimitadas • Código de barras • Alertas personalizados de água e refeições</p>
              <button className="mt-3 w-full py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs">
                Assinar Plano Pro
              </button>
            </div>

            <div className="bg-[#111827] border border-blue-500/40 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-white">Plano Elite (Performance)</h3>
              <p className="text-2xl font-extrabold text-blue-400 mt-1">R$ 49,90<span className="text-xs text-gray-400">/mês</span></p>
              <p className="text-xs text-gray-300 mt-1">• Recálculo dinâmico anti-platô semanal • Relatório PDF para Nutricionista • IA Prioritária</p>
              <button className="mt-3 w-full py-2.5 rounded-xl bg-blue-500 text-white font-bold text-xs">
                Assinar Plano Elite
              </button>
            </div>

            {/* Card de Pacote Avulso */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/40 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400">Sem Assinatura • Pix</span>
                  <h3 className="text-sm font-bold text-white">Pacote Avulso (+50 Fotos IA)</h3>
                  <p className="text-xs text-gray-400">Use quando quiser, sem mensalidade.</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-amber-400">R$ 14,90</span>
                  <button className="block mt-1 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs">
                    Comprar Créditos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Barra de Navegação Inferior */}
      <nav className="fixed bottom-0 w-full max-w-md bg-[#111827]/95 backdrop-blur border-t border-gray-800 flex justify-around py-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('diario')}
          className={activeTab === 'diario' ? 'text-cyan-400' : 'text-gray-400'}
        >
          📸 Diário & IA
        </button>
        <button
          onClick={() => setActiveTab('metas')}
          className={activeTab === 'metas' ? 'text-cyan-400' : 'text-gray-400'}
        >
          🎯 Peso & Metas
        </button>
        <button
          onClick={() => setActiveTab('planos')}
          className={activeTab === 'planos' ? 'text-cyan-400' : 'text-gray-400'}
        >
          💎 Planos & Créditos
        </button>
      </nav>
    </div>
  );
}
