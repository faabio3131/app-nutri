import type { Metadata } from 'next';
import { PLANS, APP_URL } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'NutriSnap IA — calorias e macros por foto',
  description: 'Fotografe o prato e veja calorias, proteínas, carboidratos e gorduras em segundos. 3 fotos grátis, sem cartão.',
};

export default function LandingPage() {
  return (
    <div className="bg-[#0B0F17] text-gray-100 font-sans antialiased min-h-screen selection:bg-cyan-400 selection:text-slate-950">
      {/* Header / Navbar */}
      <header className="fixed top-0 w-full bg-[#0B0F17]/80 backdrop-blur-md border-b border-gray-800/80 z-50">
        <div className="max-w-6xl mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-white">
              Nutri<span className="text-cyan-400">Snap</span> IA
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#recursos" className="hover:text-cyan-400 transition">Recursos</a>
            <a href="#como-funciona" className="hover:text-cyan-400 transition">Como Funciona</a>
            <a href="#precos" className="hover:text-cyan-400 transition">Planos</a>
          </nav>
          <a href="#precos" className="px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 hover:opacity-90 transition">
            Garantir Meu Acesso
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-5 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-6">
          ✨ Powered by Google Gemini Vision
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Transforme qualquer foto do seu prato em <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">calorias e macros precisos</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-gray-400 max-w-2xl mx-auto">
          Esqueça a digitação manual de alimentos. O NutriSnap IA analisa sua refeição em segundos, calcula proteínas, carboidratos, gorduras e atualiza o seu diário alimentar automaticamente.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <a href={APP_URL} className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-cyan-500/25 hover:opacity-90 transition">
            Testar Grátis Agora
          </a>
          <a href="#como-funciona" className="px-8 py-4 rounded-xl bg-gray-900 border border-gray-800 text-white font-bold text-sm hover:bg-gray-800 transition">
            Ver Demonstração
          </a>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-20 border-t border-gray-800/80 bg-gray-950/50">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Simples como tirar uma foto</h2>
            <p className="text-sm text-gray-400 mt-2">Três passos para manter sua dieta 100% sob controle.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold mb-4">1</div>
              <h3 className="font-bold text-white text-base">Fotografe sua Refeição</h3>
              <p className="text-xs text-gray-400 mt-2">Aponte a câmera para o prato no almoço, jantar ou lanche da tarde.</p>
            </div>
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold mb-4">2</div>
              <h3 className="font-bold text-white text-base">Análise Instantânea da IA</h3>
              <p className="text-xs text-gray-400 mt-2">O motor de visão computacional identifica os alimentos, gramas estimadas e macronutrientes.</p>
            </div>
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold mb-4">3</div>
              <h3 className="font-bold text-white text-base">Bata sua Meta Diária</h3>
              <p className="text-xs text-gray-400 mt-2">O diário atualiza o progresso do dia e você pode ligar lembretes de água e refeições.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planos de Preços */}
      <section id="precos" className="py-20 px-5 max-w-6xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Escolha como quer começar</h2>
          <p className="text-sm text-gray-400 mt-2">Experimente grátis com 3 fotos ou escolha um pacote para uso contínuo.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 items-stretch">
          {/* Plano Grátis (3 fotos de teste) */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400">Teste Prático</span>
              <h3 className="text-sm font-bold text-white mt-1">Starter Grátis</h3>
              <p className="text-3xl font-extrabold text-gray-200 mt-2">R$ 0</p>
              <p className="text-xs text-cyan-400 font-semibold mt-1">3 fotos de teste</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Teste a IA Vision na prática</li>
                <li>✓ Sem cartão de crédito</li>
                <li>✓ Acesso imediato com e-mail e senha</li>
              </ul>
            </div>
            <a href={APP_URL} className="mt-8 block text-center py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs transition">
              Começar Teste Grátis
            </a>
          </div>

          {/* Pacote Essencial (Asaas) */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400">Assinatura mensal</span>
              <h3 className="text-sm font-bold text-white mt-1">Pacote Essencial</h3>
              <p className="text-3xl font-extrabold text-gray-200 mt-2">R$ 25,90</p>
              <p className="text-xs text-cyan-400 font-semibold mt-1">60 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Análise de pratos com IA Vision</li>
                <li>✓ Diário de macros e calorias</li>
                <li>✓ Pix ou cartão, liberação em instantes</li>
                <li>✓ Metas de calorias, macros e água</li>
              </ul>
            </div>
            <a href={PLANS[0].link} className="mt-8 block text-center py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs transition">
              Quero o Essencial
            </a>
          </div>

          {/* Pacote Pro (Mais Popular - Asaas / Hotmart) */}
          <div className="bg-[#111827] border-2 border-cyan-400 rounded-2xl p-6 flex flex-col justify-between relative shadow-2xl shadow-cyan-500/10">
            <span className="absolute -top-3 right-6 bg-cyan-400 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              Mais Popular
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-300">Recomendado</span>
              <h3 className="text-sm font-bold text-white mt-1">Pacote Pro</h3>
              <p className="text-3xl font-extrabold text-cyan-400 mt-2">R$ 49,90</p>
              <p className="text-xs text-cyan-300 font-semibold mt-1">150 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Até 5 fotos diárias com IA</li>
                <li>✓ Metas de calorias, macros e água</li>
                <li>✓ Lembretes de água e refeições</li>
                <li>✓ Diário alimentar salvo na sua conta</li>
              </ul>
            </div>
            <a href={PLANS[1].link} className="mt-8 block text-center py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 hover:opacity-90 transition">
              Assinar Pacote Pro
            </a>
          </div>

          {/* Pacote Power (Asaas / Hotmart) */}
          <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400">Máxima Performance</span>
              <h3 className="text-sm font-bold text-white mt-1">Pacote Power</h3>
              <p className="text-3xl font-extrabold text-amber-400 mt-2">R$ 79,90</p>
              <p className="text-xs text-amber-300 font-semibold mt-1">300 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Até 10 fotos diárias com IA</li>
                <li>✓ Ideal para atletas e uso intenso</li>
                <li>✓ Suporte prioritário via WhatsApp</li>
                <li>✓ Agenda semanal de treinos</li>
              </ul>
            </div>
            <a href={PLANS[2].link} className="mt-8 block text-center py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition">
              Quero o Power
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-10 text-center text-xs text-gray-400 space-y-2">
        <p>&copy; 2026 NutriSnap IA - FM Tecnologia IA LTDA. Todos os direitos reservados.</p>
        <p>WhatsApp: (11) 97835-0851 | E-mail: contato@fmtecnologiaia.com.br</p>
        <p><a className="underline" href="/termos/">Termos de Uso</a> • <a className="underline" href="/privacidade/">Política de Privacidade</a></p>
        <p className="max-w-xl mx-auto px-5">As estimativas são feitas por IA, são aproximadas e não substituem orientação de nutricionista ou médico.</p>
      </footer>
    </div>
  );
}
