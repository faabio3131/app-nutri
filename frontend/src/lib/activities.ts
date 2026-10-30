// Atividades e estimativa de gasto. Os valores (MET) espelham o servidor, que é quem calcula de verdade ao gravar.
export const ACTIVITIES: { id: string; label: string; met: [number, number, number] }[] = [
  { id: 'caminhada', label: 'Caminhada', met: [2.8, 3.8, 5.0] },
  { id: 'corrida', label: 'Corrida', met: [8.0, 9.8, 11.8] },
  { id: 'musculacao', label: 'Musculação', met: [3.0, 4.5, 6.0] },
  { id: 'bicicleta', label: 'Bicicleta', met: [4.0, 6.8, 10.0] },
  { id: 'natacao', label: 'Natação', met: [4.5, 6.0, 9.8] },
  { id: 'danca', label: 'Dança', met: [3.5, 5.0, 7.0] },
  { id: 'funcional', label: 'Funcional / HIIT', met: [4.5, 7.0, 10.0] },
  { id: 'outro', label: 'Outro', met: [3.0, 4.5, 6.5] },
];
export type Intensity = 'leve' | 'moderada' | 'intensa';
export const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'leve', label: 'Leve' }, { id: 'moderada', label: 'Moderada' }, { id: 'intensa', label: 'Intensa' },
];

export function activityLabel(id: string): string {
  return ACTIVITIES.find((a) => a.id === id)?.label || id.charAt(0).toUpperCase() + id.slice(1);
}

/** Gasto líquido estimado: (MET − 1) × peso × horas. */
export function estimateBurn(activity: string, minutes: number, intensity: Intensity, weightKg: number): number {
  const a = ACTIVITIES.find((x) => x.id === activity) || ACTIVITIES[ACTIVITIES.length - 1];
  const idx = intensity === 'leve' ? 0 : intensity === 'intensa' ? 2 : 1;
  const kg = weightKg >= 30 && weightKg <= 300 ? weightKg : 70;
  return Math.max(0, Math.round((a.met[idx] - 1) * kg * (minutes / 60)));
}
