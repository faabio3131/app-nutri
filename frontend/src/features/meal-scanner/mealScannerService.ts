import { api, Usage } from '@/lib/api';

export interface MealItem {
  name: string; estimated_weight_g: number; calories: number; protein_g: number; carbs_g: number; fat_g: number;
}
export interface MealAnalysis {
  meal_summary: { name: string; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number; confidence_level: string; notes: string; alternatives?: string[]; is_liquid?: boolean; serving_amount?: number; serving_unit?: string };
  items: MealItem[];
}
export interface AnalyzeResponse { meal_id: string; meal_type: string; data: MealAnalysis; usage: Usage }

// Reduz a foto antes do envio (rápido no 4G e dentro do limite de 8 MB).
export async function compressMealImage(file: File, maxWidth = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Não foi possível preparar a foto.'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível preparar a foto.'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta foto. Tente outra.')); };
    img.src = url;
  });
}

export async function analyzeMealPhoto(file: File, mealType?: string): Promise<AnalyzeResponse> {
  const blob = await compressMealImage(file);
  const form = new FormData();
  form.append('image', blob, 'prato.jpg');
  if (mealType) form.append('meal_type', mealType);
  return api<AnalyzeResponse>('/meals/analyze', { method: 'POST', form });
}
