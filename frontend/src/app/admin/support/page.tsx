"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, MessageCircle, RefreshCw, Send, UserRound } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type Conversation = { id:number; status:string; subject:string|null; updatedAt:string; lastMessage:any; customer:{id:number;name:string|null;email:string|null}|null; guestName?:string|null; guestEmail?:string|null; agent:any };
type Message = { id:number; content:string; senderRole:string; senderId:number|null; createdAt:string; sender:{id:number;name:string|null}|null };

export default function AdminSupportPage(){
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [selected,setSelected]=useState<number|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");

  const loadList=async()=>{
    try{const j=await fetchWithAuth("/api/admin/support/chat",{cache:"no-store"}); setConversations(j.data||[]); if(selected&&!j.data?.some((x:Conversation)=>x.id===selected))setSelected(null); setError("");}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar.");} finally{setLoading(false);}
  };
  const loadConversation=async(id:number)=>{
    try{const j=await fetchWithAuth("/api/admin/support/chat?conversationId="+id,{cache:"no-store"}); setMessages(j.data?.messages||[]); setError("");}
    catch(e){setError(e instanceof Error?e.message:"Erro ao carregar a conversa.");}
  };
  useEffect(()=>{loadList(); const t=window.setInterval(loadList,5000); return()=>window.clearInterval(t)},[]);
  useEffect(()=>{if(selected){loadConversation(selected); const t=window.setInterval(()=>loadConversation(selected),4000); return()=>window.clearInterval(t)}},[selected]);

  const send=async(e:FormEvent)=>{
    e.preventDefault(); if(!selected||!draft.trim()||sending)return; setSending(true);
    try{await fetchWithAuth("/api/admin/support/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversationId:selected,content:draft.trim()})}); setDraft(""); await loadConversation(selected); await loadList();}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível enviar.");} finally{setSending(false);}
  };

  return <main className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d6ac4]">Atendimento</p><h1 className="mt-1 text-2xl font-black text-gray-950">Chat de suporte</h1><p className="mt-1 text-sm text-gray-500">Atenda clientes em tempo real e mantenha o histórico persistente.</p></div>
      <button onClick={loadList} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"><RefreshCw size={15}/> Atualizar</button>
    </div>
    {error&&<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}
    <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-gray-200 bg-white lg:grid-cols-[330px_1fr]">
      <aside className="border-b border-gray-200 lg:border-b-0 lg:border-r">
        <div className="border-b border-gray-100 p-4"><p className="text-xs font-black text-gray-900">Conversas</p><p className="mt-1 text-[11px] text-gray-400">{conversations.length} conversa(s)</p></div>
        <div className="max-h-[560px] overflow-y-auto">
          {loading?<div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400"/></div>:conversations.map(c=><button key={c.id} onClick={()=>setSelected(c.id)} className={`w-full border-b border-gray-100 p-4 text-left transition hover:bg-gray-50 ${selected===c.id?"bg-blue-50":"bg-white"}`}>
            <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-bold text-gray-900">{c.customer?.name||c.guestName||c.customer?.email||c.guestEmail||"Cliente"}</span><span className="text-[10px] text-gray-400">#{c.id}</span></div>
            <p className="mt-0.5 truncate text-[10px] text-gray-400">{c.customer?.email||c.guestEmail||""}{!c.customer&&" · Visitante"}</p>
            <p className="mt-1 truncate text-xs text-gray-500">{c.subject||"Pedido de suporte"}</p>
            <div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] text-gray-400">{c.lastMessage?.content||"Sem mensagens"}</span><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-500">{c.status}</span></div>
          </button>)}
          {!loading&&!conversations.length&&<div className="p-8 text-center text-xs text-gray-400">Ainda não existem conversas.</div>}
        </div>
      </aside>
      <section className="flex min-h-[620px] flex-col">
        {!selected?<div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><MessageCircle className="text-gray-300" size={40}/><h2 className="mt-3 text-sm font-black text-gray-900">Selecione uma conversa</h2><p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">As novas mensagens aparecem automaticamente nesta área.</p></div>:
        <>
          <div className="border-b border-gray-100 p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-[#1d6ac4]"><UserRound size={17}/></div><div><p className="text-sm font-black text-gray-900">{conversations.find(c=>c.id===selected)?.customer?.name||conversations.find(c=>c.id===selected)?.guestName||"Conversa #"+selected}</p><p className="text-[11px] text-gray-500">{conversations.find(c=>c.id===selected)?.customer?.email||conversations.find(c=>c.id===selected)?.guestEmail||"Atualização automática a cada 4 segundos"}</p></div></div></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">{messages.map(m=><div key={m.id} className={`flex ${m.senderRole==="AGENT"?"justify-end":"justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.senderRole==="AGENT"?"rounded-br-md bg-[#1d6ac4] text-white":"rounded-bl-md bg-gray-100 text-gray-800"}`}><p className="mb-1 text-[10px] font-bold opacity-70">{m.senderRole==="AGENT"?"Suporte":m.sender?.name||(m.senderRole==="GUEST"?"Visitante":"Cliente")}</p><p className="whitespace-pre-wrap leading-6">{m.content}</p><p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString("pt-PT")}</p></div></div>)}</div>
          <form onSubmit={send} className="border-t border-gray-100 p-4"><div className="flex items-end gap-2 rounded-xl border border-gray-200 p-2 focus-within:border-[#1d6ac4]"><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={2} maxLength={4000} placeholder="Responder ao cliente..." className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"/><button disabled={!draft.trim()||sending} className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1d6ac4] text-white disabled:opacity-40">{sending?<Loader2 className="animate-spin" size={17}/>:<Send size={17}/>}</button></div></form>
        </>}
      </section>
    </div>
  </main>;
}
