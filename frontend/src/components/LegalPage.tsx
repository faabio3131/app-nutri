export default function LegalPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-gray-200 px-5 py-10 font-sans">
      <article className="max-w-2xl mx-auto text-sm leading-relaxed space-y-4">
        <a href="/" className="text-xs text-cyan-400 underline">← Voltar ao NutriSnap IA</a>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        <p className="text-xs text-gray-500">Versão {version} • FM Tecnologia IA LTDA</p>
        {children}
        <p className="text-xs text-gray-500 pt-6 border-t border-gray-800">Dúvidas ou pedidos: contato@fmtecnologiaia.com.br • WhatsApp (11) 97835-0851</p>
      </article>
    </main>
  );
}
