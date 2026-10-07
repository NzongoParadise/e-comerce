"use client";

import { Building2, Save } from "lucide-react";
import { useState } from "react";

export default function B2BCompanyPage() {
  const [saved,setSaved]=useState(false);
  return <main className="container mx-auto max-w-4xl px-4 py-8">
    <div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#1d6ac4]">B2B · Empresa</p><h1 className="mt-1 text-3xl font-black text-[#0c1b2a]">Dados da empresa</h1><p className="mt-2 text-sm text-gray-500">Mantenha os dados comerciais e de faturação atualizados.</p></div>
    <section className="border bg-white p-6"><div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1d6ac4]"><Building2 size={20}/></span><div><h2 className="font-black">Perfil empresarial</h2><p className="text-xs text-gray-500">Informação utilizada no relacionamento comercial.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2">{[["Razão social","RUBRICA DILIGENTE (SU), LDA"],["NIF","000000000"],["Email comercial","comercial@rubricadiligente.ao"],["Telefone","+244 9XX XXX XXX"],["Morada","Angola"],["Responsável","Administrador da conta"]].map(([label,value])=><label key={label} className="text-xs font-bold text-gray-600">{label}<input defaultValue={value} className="mt-2 w-full border border-gray-200 px-3 py-3 text-sm font-medium outline-none focus:border-[#1d6ac4]"/></label>)}</div>
      <div className="mt-7 flex items-center justify-end gap-3"><span className="text-xs text-green-600">{saved ? "Alterações guardadas." : ""}</span><button onClick={()=>setSaved(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0c1b2a] px-4 py-3 text-xs font-black text-white"><Save size={15}/> Guardar alterações</button></div>
    </section>
  </main>;
}
