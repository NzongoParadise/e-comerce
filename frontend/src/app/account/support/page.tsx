"use client";

const helpTopics = [
  { icon: "📅", title: "Encomendas", desc: "Acompanhar, alterar ou cancelar" },
  { icon: "💳", title: "Pagamentos", desc: "Formas de pagamento, facturação" },
  { icon: "🚚", title: "Entregas", desc: "Prazos e áreas de entrega" },
  { icon: "❤️", title: "Devoluções", desc: "Trocas e reembolsos" },
  { icon: "🛡️", title: "Garantia", desc: "Assistência técnica" },
  { icon: "📋", title: "Produtos", desc: "Informações e especificações" },
  { icon: "👤", title: "Conta", desc: "Perfil, endereços e segurança" },
  { icon: "🏢", title: "Empresas (B2B)", desc: "Condições especiais e parcerias" },
];

export default function SupportPage() {
  return (
    <div>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-8 mb-8 relative overflow-hidden flex justify-between items-center">
        <div className="z-10 w-full max-w-md">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Como podemos ajudar?</h1>
          <p className="text-sm text-gray-700 mb-6 font-medium">Encontre respostas, fale connosco ou abra um pedido de suporte.</p>
          
          <div className="flex bg-white rounded-lg shadow-sm">
            <input 
              type="text" 
              placeholder="Digite a sua dúvida, palavra-chave ou n° da encomenda..." 
              className="flex-1 px-4 py-3 text-sm rounded-l-lg border-y border-l border-gray-200 focus:outline-none focus:border-[#1d6ac4]"
            />
            <button className="bg-[#1d6ac4] text-white px-5 rounded-r-lg hover:bg-[#155099] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
          </div>
          
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-600">Pesquisas populares:</span>
            {["Estado da encomenda", "Devoluções", "Garantia", "Factura", "Métodos de pagamento"].map(tag => (
              <span key={tag} className="text-[11px] bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-600 cursor-pointer hover:border-[#1d6ac4] hover:text-[#1d6ac4]">
                {tag}
              </span>
            ))}
          </div>
        </div>
        
        {/* Placeholder for Support Agent Image */}
        <div className="hidden md:flex text-6xl opacity-20 absolute right-12 bottom-0 transform translate-y-4">
          👩‍💼
        </div>
        <div className="hidden md:block absolute top-6 right-32 transform rotate-12 bg-white/80 backdrop-blur px-3 py-1 rounded-lg shadow-sm text-sm font-bold text-gray-800 italic">
          Estamos aqui para si!
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Topics & Articles */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Temas de ajuda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {helpTopics.map((topic) => (
              <div key={topic.title} className="card p-4 flex gap-4 cursor-pointer hover:border-[#1d6ac4] group transition-colors">
                <div className="h-10 w-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center text-xl group-hover:bg-[#1d6ac4] group-hover:text-white transition-colors">
                  {topic.icon}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm flex items-center gap-1">
                    {topic.title}
                    <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-[#1d6ac4]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{topic.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-4">Artigos mais consultados</h2>
          <div className="space-y-3 mb-8">
            {[
              "Como acompanhar a minha encomenda?",
              "Quais são os métodos de pagamento disponíveis?",
              "Qual o prazo de entrega em Luanda?",
              "Como solicitar uma devolução?",
              "Como activar a garantia de um produto?"
            ].map((article, i) => (
              <div key={article} className="flex items-center gap-3 cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-[#1d6ac4] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="text-sm font-medium text-gray-700 group-hover:text-[#1d6ac4] transition-colors">
                  {article}
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-[#e8f0fc] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-blue-100">
             <div className="flex items-center gap-4">
               <div className="text-4xl">🎧</div>
               <div>
                 <h3 className="font-bold text-gray-900">Ainda precisa de ajuda?</h3>
                 <p className="text-xs text-gray-600">A nossa equipa está disponível para o apoiar em todo o processo.</p>
               </div>
             </div>
             <button className="btn-primary whitespace-nowrap">Abrir um pedido de suporte</button>
          </div>
        </div>

        {/* Right: Contact Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-[#1d6ac4] flex items-center justify-center text-xl flex-shrink-0">🕒</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Horário de atendimento</h3>
                <div className="text-sm font-medium text-gray-700 my-1">Segunda a Sábado<br/>8h00 – 20h00</div>
                <div className="inline-block bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-1">Online agora</div>
              </div>
            </div>
          </div>

          <div className="card p-5 border-[#1d6ac4] shadow-md shadow-blue-500/10">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-full bg-[#1d6ac4] text-white flex items-center justify-center text-xl flex-shrink-0">💬</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Fale connosco</h3>
                <div className="text-xs text-gray-500 my-1">Atendimento rápido e seguro pela nossa equipa.</div>
              </div>
            </div>
            <button className="btn-primary w-full py-2.5">Iniciar chat</button>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-[#1d6ac4] flex items-center justify-center text-xl flex-shrink-0">📞</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Ligar agora</h3>
                <div className="text-sm font-bold text-gray-700 my-1">+244 923 000 000</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 text-[#1d6ac4] flex items-center justify-center text-xl flex-shrink-0">✉️</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Enviar e-mail</h3>
                <div className="text-sm font-bold text-[#1d6ac4] my-1 hover:underline cursor-pointer">suporte@techglobal.co.ao</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl flex-shrink-0">📱</div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">WhatsApp</h3>
                <div className="text-sm font-bold text-gray-700 my-1">+244 923 000 000</div>
              </div>
            </div>
          </div>
          
          <div className="card p-5 mt-8 bg-gray-50">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">🚚</span>
              <h3 className="font-bold text-gray-900 text-sm">Acompanhamento de pedido</h3>
            </div>
            <input type="text" placeholder="Introduza o n° da encomenda" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d6ac4] bg-white mb-2" />
            <div className="flex">
              <input type="text" placeholder="Ex.: TG20260920-008" className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d6ac4] bg-white" />
              <button className="bg-[#1d6ac4] text-white px-4 rounded-r-lg hover:bg-[#155099] transition-colors">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
