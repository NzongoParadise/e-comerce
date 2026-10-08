import SupportChatPanel from "@/components/support/SupportChatPanel";

export default function B2BSupportPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Área empresarial · Ajuda</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Suporte para a sua empresa</h1><p className="mt-2 text-sm text-slate-500">Fale com a equipa sobre cotações, encomendas, pagamentos ou gestão da empresa.</p></div>
      <SupportChatPanel />
    </div>
  );
}
