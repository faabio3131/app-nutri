import WorkoutModule from '@/components/WorkoutModule';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#0B0F17] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-black text-white">Painel do Utilizador - <span className="text-cyan-400">NutriSnap IA</span></h1>
          <p className="text-xs text-gray-400 mt-1">FM Tecnologia IA LTDA - Gestão Completa de Dieta e Treinos</p>
        </header>

        {/* Módulo de Treinos e Queima Calórica */}
        <WorkoutModule />
      </div>
    </main>
  );
}
