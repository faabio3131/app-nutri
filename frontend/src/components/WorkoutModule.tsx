"use client";

import { useState } from 'react';

export default function WorkoutModule() {
  const [activity, setActivity] = useState('caminhada');
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState('moderada');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRegisterWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'user_local_123',
          activity_type: activity,
          duration_min: Number(duration),
          intensity: intensity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResult(data.data);
      } else {
        alert('Erro ao registar treino');
      }
    } catch (error) {
      console.error('Erro de conexão:', error);
      alert('Não foi possível conectar ao servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 text-gray-100 shadow-xl max-w-xl mx-auto my-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          🏃‍♂️ Agenda de Treinos & Gasto Calórico
        </h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
          Tempo Real
        </span>
      </div>

      <form onSubmit={handleRegisterWorkout} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">Tipo de Atividade</label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
          >
            <option value="caminhada">Caminhada</option>
            <option value="corrida">Corrida</option>
            <option value="musculacao">Musculação</option>
            <option value="bicicleta">Bicicleta</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Duração (minutos)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Intensidade</label>
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              className="w-full bg-[#0B0F17] border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
            >
              <option value="leve">Leve</option>
              <option value="moderada">Moderada</option>
              <option value="intensa">Intensa</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Calculando Gasto Calórico...' : 'Registar Atividade & Calcular Calorias'}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 rounded-xl bg-[#0B0F17] border border-cyan-500/30 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium capitalize">{result.activity_type} ({result.intensity}) - {result.duration_min} min</p>
            <p className="text-sm font-bold text-white mt-1">Queima Estimada</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-cyan-400">{result.calories_burned}</span>
            <span className="text-xs text-gray-400 ml-1">kcal</span>
          </div>
        </div>
      )}
    </div>
  );
}
