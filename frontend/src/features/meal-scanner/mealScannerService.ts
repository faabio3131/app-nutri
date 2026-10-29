export interface MealItem {
  name: string;
  estimated_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealAnalysisResponse {
  meal_summary: {
    name: string;
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    confidence_level: string;
    notes: string;
  };
  items: MealItem[];
}

// Comprime a foto da câmera no próprio celular para ~200KB (WebP) antes do upload
export async function compressMealImage(file: File, maxWidth = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Falha ao inicializar Canvas'));

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Falha na compressão WebP'))),
        'image/webp',
        quality
      );
    };
    img.onerror = (err) => reject(err);
  });
}

// Envia a imagem comprimida para o Backend em Go
export async function analyzeMealPhoto(file: File, locale = 'pt-BR'): Promise<MealAnalysisResponse> {
  const compressedBlob = await compressMealImage(file);
  const formData = new FormData();
  formData.append('image', compressedBlob, 'meal.webp');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
  const response = await fetch(${apiUrl}/meals/analyze, {
    method: 'POST',
    headers: {
      'Accept-Language': locale,
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Erro ao analisar refeição');
  }

  const result = await response.json();
  return result.data;
}
