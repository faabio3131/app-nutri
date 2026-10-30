import type { Metadata } from 'next';
import { PLANS, APP_URL } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'NutriSnap IA — fotografe o prato e veja as calorias em segundos',
  description:
    'Tire uma foto do prato e descubra calorias, proteínas, carboidratos e gorduras em segundos. Diário alimentar, metas, lembretes e agenda de treinos. Teste grátis com 3 fotos, sem cartão.',
};

const FEATURES = [
  { icon: '📸', title: 'Análise por foto', text: 'Fotografe o prato e receba calorias, proteínas, carboidratos e gorduras estimados pela IA em segundos.' },
  { icon: '📒', title: 'Diário alimentar', text: 'Cada refeição analisada vai direto para o seu diário do dia, salvo na sua conta e disponível em qualquer aparelho.' },
  { icon: '🎯', title: 'Metas sob medida', text: 'Informe peso, altura, idade e objetivo. O app calcula suas metas diárias de calorias e macros e mostra quanto falta.' },
  { icon: '💧', title: 'Lembretes de água e refeições', text: 'Ligue os lembretes e mantenha a rotina sem depender da memória (funcionam com o app aberto no navegador).' },
  { icon: '🏋️', title: 'Agenda semanal de treinos', text: 'Monte a sua semana de treinos no mesmo lugar em que acompanha a alimentação.' },
  { icon: '🔒', title: 'Seus dados são seus', text: 'A foto não fica guardada. Você pode exportar ou apagar a sua conta quando quiser, em conformidade com a LGPD.' },
];

const BENEFITS = [
  { title: 'Mais energia no dia a dia', text: 'Quando você entende o que coloca no prato, fica mais fácil montar refeições que sustentam a sua disposição de manhã à noite.' },
  { title: 'Resultado que você enxerga', text: 'Emagrecer, definir ou ganhar massa começa por um número simples: quanto você realmente come. Agora ele está a uma foto de distância.' },
  { title: 'Consciência, sem culpa', text: 'Nada de planilha, balança ou digitar alimento por alimento. Você decide melhor porque enxerga o que está comendo.' },
];

const FAQ = [
  { q: 'A IA acerta as calorias?', a: 'Ela faz uma estimativa a partir da foto, com boa aproximação para o dia a dia. Porções escondidas e molhos podem variar. Não substitui a orientação de um nutricionista ou médico.' },
  { q: 'Preciso instalar algum aplicativo?', a: 'Não. O NutriSnap IA abre direto no navegador do celular ou do computador. Basta criar a conta com e-mail e senha.' },
  { q: 'O teste grátis pede cartão?', a: 'Não. Você cria a conta e analisa 3 fotos para ver na prática como funciona.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. A assinatura é mensal, sem fidelidade. Use o mesmo e-mail da conta na hora da compra para liberar o plano.' },
  { q: 'O que acontece com as minhas fotos e dados?', a: 'A foto é enviada só para a análise e não fica armazenada. Dados de saúde são tratados com o seu consentimento, e você pode exportar ou apagar tudo na própria conta.' },
  { q: 'Como pago?', a: 'Por Pix ou cartão, em checkout seguro da Cakto. O acesso é liberado em instantes após a confirmação.' },
];

const cta = 'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 px-8 py-4 text-sm font-extrabold text-emerald-950 shadow-xl shadow-emerald-500/25 transition hover:brightness-105';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07110d] font-sans text-gray-100 antialiased selection:bg-emerald-400 selection:text-emerald-950">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#07110d]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-xl font-extrabold tracking-tight text-white">
            Nutri<span className="text-emerald-400">Snap</span> IA
          </span>
          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-300 md:flex">
            <a href="#beneficios" className="transition hover:text-emerald-400">Benefícios</a>
            <a href="#recursos" className="transition hover:text-emerald-400">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-emerald-400">Como funciona</a>
            <a href="#precos" className="transition hover:text-emerald-400">Planos</a>
          </nav>
          <a href={APP_URL} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300">
            Testar grátis
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-32 md:grid-cols-2">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Teste grátis: 3 fotos, sem cartão
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
            Seu prato, <span className="bg-gradient-to-r from-emerald-400 to-lime-300 bg-clip-text text-transparent">decifrado em segundos.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-gray-300 md:text-lg">
            Tire uma foto da refeição e descubra calorias, proteínas, carboidratos e gorduras. Sem balança, sem planilha e sem digitar alimento por alimento. Comer bem fica simples quando você enxerga o que está no prato.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <a href={APP_URL} className={cta}>Quero testar grátis agora</a>
            <a href="#precos" className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-bold text-white transition hover:bg-white/10">
              Ver planos
            </a>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-gray-300 sm:grid-cols-3">
            <li>✓ Abre no navegador</li>
            <li>✓ Pix ou cartão</li>
            <li>✓ Cancele quando quiser</li>
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-emerald-400/20 blur-3xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/hero-foto-prato.jpg" alt="Celular fotografando um prato com frango, arroz e salada" width={857} height={570} className="relative w-full rounded-3xl border border-white/10 shadow-2xl" />
          <div className="absolute -bottom-5 left-4 rounded-2xl bg-white px-5 py-3 text-emerald-950 shadow-xl sm:left-8">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Exemplo de resultado</p>
            <p className="text-2xl font-black">450 kcal <span className="text-sm font-semibold text-emerald-800">· P 32g · C 45g · G 12g</span></p>
          </div>
        </div>
      </section>

      {/* Benefícios de comer bem */}
      <section id="beneficios" className="border-y border-white/10 bg-[#0a1812] py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-[1fr_1.2fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/mulher-comendo.jpg" alt="Mulher sorrindo ao comer uma refeição saudável" width={437} height={540} className="mx-auto w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl" />
          <div>
            <h2 className="text-3xl font-extrabold text-white md:text-4xl">
              Comer bem muda a sua rotina. <span className="text-emerald-400">Saber o que come muda o jogo.</span>
            </h2>
            <p className="mt-4 text-gray-300">
              Não existe dieta eficaz sem consciência. O NutriSnap IA tira o atrito do caminho para você fazer escolhas melhores todos os dias, sem transformar a comida em obrigação.
            </p>
            <div className="mt-8 space-y-4">
              {BENEFITS.map((b) => (
                <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-white">{b.title}</h3>
                  <p className="mt-1 text-sm text-gray-300">{b.text}</p>
                </div>
              ))}
            </div>
            <a href={APP_URL} className={`${cta} mt-8`}>Começar com 3 fotos grátis</a>
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">Tudo o que você precisa para manter o foco</h2>
          <p className="mt-3 text-gray-400">Do prato ao diário, das metas ao treino, em um só lugar.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-[#0d1a14] p-6 transition hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10 text-2xl">{f.icon}</div>
              <h3 className="font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-300">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-y border-white/10 bg-[#0a1812] py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold text-white md:text-4xl">Simples como tirar uma foto</h2>
            <p className="mt-3 text-gray-400">Três passos e a sua refeição já está no diário.</p>
            <ol className="mt-8 space-y-6">
              {[
                ['Fotografe o prato', 'Aponte a câmera no almoço, no jantar ou no lanche.'],
                ['A IA analisa em segundos', 'Ela identifica os alimentos e estima porções, calorias e macros.'],
                ['Acompanhe a sua meta', 'O diário soma o dia e mostra o que falta para chegar lá.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-lg font-black text-emerald-950">{i + 1}</span>
                  <div>
                    <h3 className="font-bold text-white">{t}</h3>
                    <p className="text-sm text-gray-300">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/analise-salada.jpg" alt="Celular analisando uma salada com ovos e mostrando as calorias" width={570} height={640} className="mx-auto w-full max-w-md rounded-3xl border border-white/10 shadow-2xl" />
        </div>
      </section>

      {/* Planos */}
      <section id="precos" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">Escolha como quer começar</h2>
          <p className="mt-3 text-gray-400">Experimente grátis com 3 fotos ou escolha um plano mensal, sem fidelidade.</p>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-4">
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d1a14] p-6">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400">Teste prático</span>
              <h3 className="mt-1 text-sm font-bold text-white">Starter Grátis</h3>
              <p className="mt-2 text-3xl font-extrabold text-gray-200">R$ 0</p>
              <p className="mt-1 text-xs font-semibold text-emerald-400">3 fotos de teste</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Veja a IA funcionando na prática</li>
                <li>✓ Sem cartão de crédito</li>
                <li>✓ Acesso imediato com e-mail e senha</li>
              </ul>
            </div>
            <a href={APP_URL} className="mt-8 block rounded-xl bg-white/10 py-3 text-center text-xs font-bold text-white transition hover:bg-white/20">
              Começar teste grátis
            </a>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d1a14] p-6">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-400">Assinatura mensal</span>
              <h3 className="mt-1 text-sm font-bold text-white">Pacote Essencial</h3>
              <p className="mt-2 text-3xl font-extrabold text-gray-200">R$ 25,90</p>
              <p className="mt-1 text-xs font-semibold text-emerald-400">60 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Análise de pratos com IA</li>
                <li>✓ Diário de macros e calorias</li>
                <li>✓ Metas de calorias, macros e água</li>
                <li>✓ Pix ou cartão, liberação em instantes</li>
              </ul>
            </div>
            <a href={PLANS[0].link} className="mt-8 block rounded-xl bg-white/10 py-3 text-center text-xs font-bold text-white transition hover:bg-white/20">
              Quero o Essencial
            </a>
          </div>

          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-emerald-400 bg-[#0d1a14] p-6 shadow-2xl shadow-emerald-500/15">
            <span className="absolute -top-3 right-6 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-950">
              Mais popular
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-300">Recomendado</span>
              <h3 className="mt-1 text-sm font-bold text-white">Pacote Pro</h3>
              <p className="mt-2 text-3xl font-extrabold text-emerald-400">R$ 49,90</p>
              <p className="mt-1 text-xs font-semibold text-emerald-300">150 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Até 5 fotos por dia com IA</li>
                <li>✓ Metas de calorias, macros e água</li>
                <li>✓ Lembretes de água e refeições</li>
                <li>✓ Diário alimentar salvo na sua conta</li>
              </ul>
            </div>
            <a href={PLANS[1].link} className="mt-8 block rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 py-3 text-center text-xs font-extrabold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-105">
              Assinar Pacote Pro
            </a>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/40 bg-[#0d1a14] p-6">
            <div>
              <span className="text-[10px] font-bold uppercase text-amber-400">Máxima performance</span>
              <h3 className="mt-1 text-sm font-bold text-white">Pacote Power</h3>
              <p className="mt-2 text-3xl font-extrabold text-amber-400">R$ 79,90</p>
              <p className="mt-1 text-xs font-semibold text-amber-300">300 fotos por mês</p>
              <ul className="mt-6 space-y-3 text-xs text-gray-300">
                <li>✓ Até 10 fotos por dia com IA</li>
                <li>✓ Ideal para atletas e uso intenso</li>
                <li>✓ Suporte prioritário via WhatsApp</li>
                <li>✓ Agenda semanal de treinos</li>
              </ul>
            </div>
            <a href={PLANS[2].link} className="mt-8 block rounded-xl bg-amber-400 py-3 text-center text-xs font-extrabold text-slate-950 transition hover:bg-amber-300">
              Quero o Power
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">Use na compra o mesmo e-mail da sua conta NutriSnap para liberar o plano automaticamente.</p>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="border-t border-white/10 bg-[#0a1812] py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="mb-10 text-center text-3xl font-extrabold text-white">Perguntas frequentes</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/5 p-5 open:border-emerald-400/40">
                <summary className="cursor-pointer list-none font-bold text-white marker:hidden">
                  <span className="mr-2 text-emerald-400 group-open:hidden">+</span>
                  <span className="mr-2 hidden text-emerald-400 group-open:inline">−</span>
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-gray-300">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-black text-white md:text-5xl">
          O primeiro passo é uma <span className="text-emerald-400">foto</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-gray-300">
          Crie a sua conta, analise 3 pratos de graça e veja como é fácil saber o que você come.
        </p>
        <a href={APP_URL} className={`${cta} mt-8`}>Testar grátis agora</a>
      </section>

      <footer className="space-y-2 border-t border-white/10 py-10 pb-24 text-center text-xs text-gray-400 md:pb-10">
        <p>&copy; 2026 NutriSnap IA - FM Tecnologia IA LTDA &middot; CNPJ 07.109.248/0001-57. Todos os direitos reservados.</p>
        <p>WhatsApp: (11) 97835-0851 | E-mail: contato@fmtecnologiaia.com.br</p>
        <p><a className="underline" href="/termos/">Termos de Uso</a> • <a className="underline" href="/privacidade/">Política de Privacidade</a></p>
        <p className="mx-auto max-w-xl px-5">As estimativas são feitas por IA, são aproximadas e não substituem orientação de nutricionista ou médico.</p>
      </footer>

      {/* CTA fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07110d]/95 p-3 backdrop-blur md:hidden">
        <a href={APP_URL} className="block rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 py-3 text-center text-sm font-extrabold text-emerald-950">
          Testar grátis · 3 fotos, sem cartão
        </a>
      </div>
    </div>
  );
}
