"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  EllipsisVertical,
  FileDown,
  Filter,
  Layers3,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
} from "lucide-react";

type StockStatus = "Em stock" | "Stock baixo" | "Sem stock";

type InventoryItem = {
  id: number;
  name: string;
  reference: string;
  category: string;
  stock: number;
  minimum: number;
  price: string;
  status: StockStatus;
  image: string;
};

const inventory: InventoryItem[] = [
  { id: 1, name: "Dell Latitude 5440", reference: "DL5440-001", category: "Portáteis", stock: 28, minimum: 10, price: "1.750.000", status: "Em stock", image: "/pc_01.png" },
  { id: 2, name: "HP ProBook 450 G10", reference: "HP450G10", category: "Portáteis", stock: 15, minimum: 10, price: "1.680.000", status: "Em stock", image: "/HP.jpg" },
  { id: 3, name: "Lenovo ThinkPad E14", reference: "TP-E14-002", category: "Portáteis", stock: 8, minimum: 10, price: "1.820.000", status: "Stock baixo", image: "/Lenovo.jpg" },
  { id: 4, name: "iPhone 15", reference: "IP15-128-BK", category: "Smartphones", stock: 3, minimum: 5, price: "1.250.000", status: "Sem stock", image: "/Iphone_15.png" },
  { id: 5, name: "MacBook Air M2", reference: "MBA-M2-256", category: "Portáteis", stock: 12, minimum: 5, price: "1.850.000", status: "Em stock", image: "/conjunto de Apple.png" },
  { id: 6, name: "Samsung Galaxy S24", reference: "S24-256-BK", category: "Smartphones", stock: 6, minimum: 5, price: "1.420.000", status: "Em stock", image: "/Samsung.jpg" },
  { id: 7, name: "Logitech MX Master 3S", reference: "LOG-MX3S", category: "Acessórios", stock: 25, minimum: 10, price: "95.000", status: "Em stock", image: "/Acessorio.png" },
  { id: 8, name: "HP LaserJet Pro M428fdw", reference: "HP-M428", category: "Impressão", stock: 4, minimum: 5, price: "680.000", status: "Stock baixo", image: "/Epson.jpg" },
];

const statusStyles: Record<StockStatus, string> = {
  "Em stock": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Stock baixo": "bg-amber-50 text-amber-700 ring-amber-200",
  "Sem stock": "bg-red-50 text-red-700 ring-red-200",
};

function MetricCard({ title, value, detail, icon: Icon, tone, progress }: { title: string; value: string; detail: string; icon: typeof Box; tone: string; progress?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={18} /></span>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-gray-500">{detail}</p>
      {progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>}
    </div>
  );
}

export default function StockPage() {
  const [activeTab, setActiveTab] = useState("Todos os produtos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(1);

  const filteredInventory = useMemo(() => inventory.filter((item) => {
    const matchesSearch = `${item.name} ${item.reference}`.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "Todos os produtos" || item.status === activeTab;
    return matchesSearch && matchesTab;
  }), [activeTab, search]);

  const selected = inventory.find((item) => item.id === selectedId) ?? inventory[0];

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-2 lg:w-60">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1555d8] text-white"><Box size={19} /></div>
            <div className="hidden leading-none sm:block"><strong className="text-base font-black">TechGlobal</strong><span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-[#1555d8]">Painel Administrativo</span></div>
          </div>
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Abrir menu"><SlidersHorizontal size={18} /></button>
          <div className="relative hidden max-w-xl flex-1 md:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input placeholder="Pesquisar produtos, categorias, referências..." className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:bg-white" /></div>
          <div className="ml-auto flex items-center gap-2"><button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Notificações"><Bell size={18} /><span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-red-500 text-[8px] text-white">5</span></button><button className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 sm:block" aria-label="Mensagens"><CircleHelp size={18} /></button><div className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white sm:flex">JS</div><div className="hidden text-left text-[10px] leading-tight sm:block"><strong className="block">João da Silva</strong><span className="text-gray-500">Administrador</span></div><ChevronDown size={14} className="text-gray-500" /></div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-64px)] w-60 shrink-0 border-r border-gray-200 bg-[#10233e] text-white lg:block">
          <div className="border-b border-white/10 px-5 py-5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600"><Box size={16} /></div><div><strong className="text-sm">TechGlobal</strong><span className="block text-[9px] text-blue-200">Painel Administrativo</span></div></div></div>
          <nav className="space-y-1 p-3 text-xs font-medium">
            {[[BarChart3, "Visão geral"], [ShoppingCart, "Vendas"], [PackageCheck, "Produtos"], [Box, "Gestão de stock"], [ArrowDownToLine, "Entradas de stock"], [ArrowUpToLine, "Saídas de stock"], [Truck, "Transferências"], [SlidersHorizontal, "Ajustes de stock"], [Layers3, "Inventário"], [Layers3, "Categorias"], [Users, "Fornecedores"], [Users, "Clientes"], [BarChart3, "Financeiro"], [BarChart3, "Marketing"], [BarChart3, "Relatórios"], [Users, "Utilizadores"], [Settings, "Configurações"]].map(([Icon, label], index) => { const MenuIcon = Icon as typeof Box; return <button key={label as string} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${index === 3 ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-blue-50/80 hover:bg-white/10 hover:text-white"}`}><MenuIcon size={15} />{label as string}{index > 3 && index % 3 === 0 && <ChevronDown className="ml-auto" size={13} />}</button>; })}
          </nav>
          <div className="mx-4 mt-5 rounded-xl bg-blue-900/70 p-3 text-[10px]"><strong className="block text-sm text-white">TechGlobal Pro</strong><span className="mt-1 block text-blue-100">Mais ferramentas para o seu negócio.</span><button className="mt-3 w-full rounded-md bg-blue-600 py-2 font-bold text-white">Saber mais</button></div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-gray-400"><span>Gestão de stock</span><span>›</span><span className="text-blue-600">Produtos</span></div><h1 className="text-2xl font-black tracking-tight text-gray-950">Gestão de Stock</h1><p className="mt-1 text-xs text-gray-500">Controle o seu inventário em tempo real, gerencie entradas, saídas e transferências.</p></div><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"><FileDown size={14} />Exportar stock</button><button className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50"><ArrowUpToLine size={14} />Importar</button><button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={15} />Novo produto</button></div></div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Total de produtos" value="1,248" detail="↑ 12%   vs. mês anterior" icon={Box} tone="bg-blue-50 text-blue-600" /><MetricCard title="Em stock" value="980" detail="↑ 78%" icon={PackageCheck} tone="bg-emerald-50 text-emerald-600" progress={78} /><MetricCard title="Stock baixo" value="156" detail="↓ 13%" icon={AlertTriangle} tone="bg-amber-50 text-amber-600" progress={32} /><MetricCard title="Sem stock" value="112" detail="↓ 9%" icon={Box} tone="bg-red-50 text-red-600" progress={18} /></div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex overflow-x-auto border-b border-gray-200 px-3 pt-2 sm:px-4">{["Todos os produtos", "Stock baixo", "Sem stock", "Mais vendidos"].map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>{tab}</button>)}</div>
                <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome, referência ou código..." className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></div>{["Todas as categorias", "Todas as marcas", "Todos os armazéns"].map((filter) => <button key={filter} className="inline-flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-[10px] font-semibold text-gray-600 hover:border-blue-300"><span>{filter}</span><ChevronDown size={12} /></button>)}<button className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50" aria-label="Mais filtros"><Filter size={15} /></button></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-500"><tr><th className="w-8 px-3 py-3"><input type="checkbox" aria-label="Selecionar todos" /></th><th className="px-2 py-3">Produto</th><th className="px-2 py-3">Referência</th><th className="px-2 py-3">Categoria</th><th className="px-2 py-3">Stock</th><th className="px-2 py-3">Stock mín.</th><th className="px-2 py-3">Preço (Kz)</th><th className="px-2 py-3">Estado</th><th className="w-10 px-2 py-3">Ações</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredInventory.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selectedId === item.id ? "bg-blue-50/60" : ""}`}><td className="px-3 py-3"><input type="checkbox" aria-label={`Selecionar ${item.name}`} onClick={(event) => event.stopPropagation()} /></td><td className="px-2 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 p-1"><img src={item.image} alt="" className="h-full w-full object-contain" /></div><span className="whitespace-nowrap font-bold text-gray-800">{item.name}</span></div></td><td className="px-2 font-medium text-gray-500">{item.reference}</td><td className="px-2 text-gray-600">{item.category}</td><td className="px-2 font-bold text-gray-800">{item.stock}</td><td className="px-2 text-gray-600">{item.minimum}</td><td className="px-2 font-bold text-gray-800">{item.price}</td><td className="px-2"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles[item.status]}`}>{item.status}</span></td><td className="px-2"><button className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900" aria-label={`Ações de ${item.name}`}><EllipsisVertical size={15} /></button></td></tr>)}</tbody></table></div>
                {filteredInventory.length === 0 && <div className="p-10 text-center text-sm text-gray-500">Nenhum produto encontrado.</div>}
                <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 text-[10px] font-semibold text-gray-500 sm:flex-row sm:items-center"><span>A mostrar 1-{filteredInventory.length} de 1.248 produtos</span><div className="flex items-center gap-1"><button className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Página anterior"><ChevronLeft size={14} /></button><button className="rounded-md bg-blue-600 px-2.5 py-1.5 text-white">1</button><button className="rounded-md px-2.5 py-1.5 hover:bg-gray-100">2</button><button className="rounded-md px-2.5 py-1.5 hover:bg-gray-100">3</button><span className="px-1">...</span><button className="rounded-md px-2.5 py-1.5 hover:bg-gray-100">156</button><button className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Página seguinte"><ChevronRight size={14} /></button></div><span className="hidden sm:block">Produtos por página: <strong className="ml-1 rounded border border-gray-200 px-2 py-1 text-gray-800">8 <ChevronDown className="inline" size={10} /></strong></span></div>
              </section>

              <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-gray-900">Detalhes do produto</h2><button className="inline-flex items-center gap-1 rounded-md border border-blue-100 px-2 py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Settings size={12} />Editar</button></div><div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 p-3"><img src={selected.image} alt={selected.name} className="h-full max-w-[170px] object-contain" /></div><h3 className="mt-3 text-sm font-black text-gray-900">{selected.name}</h3><dl className="mt-3 space-y-2 text-[10px]"><div className="flex justify-between gap-3"><dt className="text-gray-500">Referência:</dt><dd className="font-bold">{selected.reference}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Categoria:</dt><dd className="font-bold">{selected.category}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Preço:</dt><dd className="font-bold">{selected.price} Kz</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Stock actual:</dt><dd className="font-bold">{selected.stock} unidades</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Stock mínimo:</dt><dd className="font-bold">{selected.minimum} unidades</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Armazém:</dt><dd className="font-bold">Luanda (Principal)</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Estado:</dt><dd><span className={`rounded-full px-2 py-1 text-[9px] font-bold ring-1 ring-inset ${statusStyles[selected.status]}`}>{selected.status}</span></dd></div></dl><div className="mt-5 space-y-2 border-t border-gray-100 pt-4"><button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[10px] font-bold text-white hover:bg-blue-700"><SlidersHorizontal size={13} />Ajustar stock</button><button className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Truck size={13} />Transferir</button><button className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><BarChart3 size={13} />Ver movimentos</button></div><div className="mt-5 border-t border-gray-100 pt-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-black">Movimentos recentes</h3><button className="text-[10px] font-bold text-blue-600">Ver todos</button></div>{[["Entrada de stock", "+10 un.", "19 Set 2026, 14:32", true], ["Saída de stock", "-5 un.", "18 Set 2026, 10:15", false], ["Entrada de stock", "+20 un.", "15 Set 2026, 09:40", true], ["Saída de stock", "-8 un.", "14 Set 2026, 16:22", false]].map(([label, amount, date, positive]) => <div key={`${label}-${date}`} className="flex items-center gap-2 border-b border-gray-50 py-2 last:border-0"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${positive ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>{positive ? <ArrowDownToLine size={11} /> : <ArrowUpToLine size={11} />}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{label}</p><p className="text-[9px] text-gray-400">{date}</p></div><strong className={`text-[10px] ${positive ? "text-emerald-600" : "text-red-600"}`}>{amount}</strong></div>)}</div></aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
