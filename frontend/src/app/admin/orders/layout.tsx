import Link from 'next/link';

export default function OrdersAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Gestão de encomendas" className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm sm:px-6">
        <Link href="/admin/orders" className="rounded px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
          Encomendas
        </Link>
        <Link href="/admin/orders/payment-review" className="rounded px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100">
          Revisão de pagamentos
        </Link>
      </nav>
      {children}
    </>
  );
}