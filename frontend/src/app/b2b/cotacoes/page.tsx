"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import {
  resolveQuoteUnitPrice,
  type QuoteCurrency,
} from "@/lib/b2b/quotePricing";

type Currency = QuoteCurrency;

type ProductPrice = {
  amount: number | string;
  currency: string;
};

type B2BPriceRule = {
  id: number;
  minQuantity: number;
  unitPrice: number | string;
  currency: string;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number | string;
  stock: number;
  prices: ProductPrice[];
  b2bPriceRules: B2BPriceRule[];
};

type QuoteItem = {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
};

type PurchaseOrderLink = {
  id: number;
  poNumber: string;
  status: string;
  orderId: number | null;
};

type Quote = {
  id: number;
  quoteNumber: string;
  status: string;
  currency: Currency;
  notes: string | null;
  createdAt: string;
  version: number;
  validUntil: string | null;
  items: QuoteItem[];
  events: Array<{ version: number; action: string; note: string | null; createdAt: string }>;
  purchaseOrders: PurchaseOrderLink[];
};

type QuoteResponse = {
  data: Quote[];
  role: string;
  company: {
    id: number;
    legalName: string;
    tradeName: string | null;
    status: string;
  };
};

type CatalogResponse = {
  data: Product[];
  company: { id: number } | null;
  message?: string;
};

type DraftItem = { productId: number; quantity: number };

const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Enviada",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovada",
  SENT: "Proposta enviada",
  ACCEPTED: "Proposta aceite",
  REVISION_REQUESTED: "Revisão solicitada",
  REJECTED: "Recusada",
  EXPIRED: "Expirada",
  CONVERTED_TO_ORDER: "Convertida em encomenda",
  CANCELLED: "Cancelada",
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-500/20",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  UNDER_REVIEW: "bg-amber-50 text-amber-800 ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  SENT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REVISION_REQUESTED: "bg-amber-50 text-amber-800 ring-amber-600/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  EXPIRED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  CONVERTED_TO_ORDER: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function formatMoney(value: number | string, currency: Currency) {
  const supportedCurrency: Currency = currency === "EUR" ? "EUR" : "AOA";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: supportedCurrency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatStatus(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${
        statusStyles[status] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageSrc = src?.trim();

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ${className}`}
    >
      {imageSrc && !failed ? (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 640px) 96px, 160px"
          className="object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <ShoppingBag
          size={22}
          className="text-slate-400"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default function B2BQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<QuoteResponse["company"] | null>(null);
  const [role, setRole] = useState("");
  const [currency, setCurrency] = useState<Currency>("AOA");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respondingQuoteId, setRespondingQuoteId] = useState<number | null>(null);
  const [revisionNotes, setRevisionNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    try {
      const [quoteResult, catalogResult] = await Promise.all([
        fetchWithAuth("/api/b2b/quotes") as Promise<QuoteResponse>,
        fetchWithAuth("/api/b2b/catalog") as Promise<CatalogResponse>,
      ]);
      setQuotes(quoteResult.data ?? []);
      setCompany(quoteResult.company ?? null);
      setRole(quoteResult.role ?? "");
      setProducts(catalogResult.data ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as cotações empresariais.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchWithAuth("/api/b2b/quotes") as Promise<QuoteResponse>,
      fetchWithAuth("/api/b2b/catalog") as Promise<CatalogResponse>,
    ])
      .then(([quoteResult, catalogResult]) => {
        if (!active) return;
        setQuotes(quoteResult.data ?? []);
        setCompany(quoteResult.company ?? null);
        setRole(quoteResult.role ?? "");
        setProducts(catalogResult.data ?? []);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar as cotações empresariais.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const canCreate =
    ["OWNER", "BUYER"].includes(role) && company?.status === "ACTIVE";
  const selectedProduct = products.find(
    (product) => product.id === Number(selectedProductId),
  );
  const selectedUnitPrice = selectedProduct
    ? resolveQuoteUnitPrice(
        selectedProduct,
        Number(selectedQuantity) || 1,
        currency,
      )
    : null;
  const draftTotal = useMemo(
    () =>
      draftItems.reduce((total, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const unitPrice = product
          ? resolveQuoteUnitPrice(product, item.quantity, currency)
          : null;
        return total + (unitPrice === null ? 0 : unitPrice * item.quantity);
      }, 0),
    [currency, draftItems, products],
  );
  const approvedCount = quotes.filter((quote) => quote.status === "APPROVED").length;
  const inReviewCount = quotes.filter((quote) =>
    ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"].includes(quote.status),
  ).length;

  function addDraftItem() {
    const productId = Number(selectedProductId);
    const quantity = Number(selectedQuantity);
    if (!Number.isInteger(productId) || productId < 1) {
      setError("Selecione um produto do catálogo.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      setError("A quantidade deve ser um número inteiro entre 1 e 100 000.");
      return;
    }
    if (draftItems.some((item) => item.productId === productId)) {
      setError("Este produto já está na cotação. Altere a quantidade na lista.");
      return;
    }

    setDraftItems((items) => [...items, { productId, quantity }]);
    setSelectedProductId("");
    setSelectedQuantity("1");
    setError("");
  }

  function changeQuantity(productId: number, value: string) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return;
    setDraftItems((items) =>
      items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    );
  }

  async function respondToProposal(
    quote: Quote,
    action: "ACCEPT" | "REJECT" | "REQUEST_REVISION",
  ) {
    const note = revisionNotes[quote.id]?.trim();
    if (action === "REQUEST_REVISION" && (!note || note.length < 3)) {
      setError("Descreva o que pretende rever antes de enviar o pedido.");
      return;
    }
    const actionLabel = action === "ACCEPT" ? "aceitar" : action === "REJECT" ? "recusar" : "solicitar uma revisão";
    if (action !== "REQUEST_REVISION" && !window.confirm(`Confirma que pretende ${actionLabel} a proposta ${quote.quoteNumber}, versão ${quote.version}?`)) {
      return;
    }

    setRespondingQuoteId(quote.id);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth("/api/b2b/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          version: quote.version,
          action,
          ...(note ? { note } : {}),
        }),
      });
      setRevisionNotes((current) => ({ ...current, [quote.id]: "" }));
      setMessage(
        action === "ACCEPT"
          ? "Proposta aceite. Já pode formalizar a encomenda através do Purchase Order."
          : action === "REJECT"
            ? "Proposta recusada."
            : "Pedido de revisão enviado à equipa comercial.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registar a sua resposta.",
      );
    } finally {
      setRespondingQuoteId(null);
    }
  }

  async function convertPurchaseOrder(poId: number, quoteNumber: string) {
    setRespondingQuoteId(poId);
    setError("");
    setMessage("");
    try {
      await fetchWithAuth(`/api/b2b/purchase-orders/convert?id=${poId}`, {
        method: "POST",
      });
      setMessage(`A encomenda da proposta ${quoteNumber} foi criada.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível formalizar a encomenda.",
      );
    } finally {
      setRespondingQuoteId(null);
    }
  }

  async function submitQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate || submitting) return;
    if (!draftItems.length) {
      setError("Adicione pelo menos um produto à cotação.");
      return;
    }
    const unpricedProduct = draftItems
      .map((item) => products.find((product) => product.id === item.productId))
      .find((product, index) => {
        const item = draftItems[index];
        return (
          product !== undefined &&
          resolveQuoteUnitPrice(product, item.quantity, currency) === null
        );
      });
    if (unpricedProduct) {
      setError(
        `Não existe preço configurado em ${currency} para ${unpricedProduct.name}. Escolha outra moeda ou contacte a equipa comercial.`,
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchWithAuth("/api/b2b/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, items: draftItems, notes }),
      });
      setQuotes((current) => [result.data, ...current]);
      setDraftItems([]);
      setNotes("");
      setMessage(
        `Pedido ${result.data.quoteNumber} enviado. A equipa comercial irá analisar a cotação.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar o pedido de cotação.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main
        className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8"
        aria-label="A carregar as cotações empresariais"
      >
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200 sm:rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-3xl">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#f6b73c]" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a6700]">
              Área empresarial <span className="px-1 text-slate-300">/</span>{" "}
              Compras
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Pedidos de cotação
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Prepare pedidos com vários artigos, escolha a moeda e acompanhe a
              análise da equipa comercial.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:px-4"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Atualizar
            </button>
            <Link
              href="/b2b/catalogo"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f6b73c] px-3 py-2.5 text-xs font-black text-[#0c1b2a] transition hover:bg-[#ffd166] sm:px-4"
            >
              <ShoppingBag size={15} aria-hidden="true" /> Catálogo
            </Link>
          </div>
        </div>
      </header>

      {message && (
        <div
          className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium leading-5 text-emerald-800 sm:px-4"
          role="status"
        >
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="shrink-0 text-xs font-bold underline"
          >
            Fechar
          </button>
        </div>
      )}
      {error && (
        <div
          className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium leading-5 text-rose-800 sm:px-4"
          role="alert"
        >
          <AlertCircle
            size={17}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 text-xs font-bold underline"
          >
            Fechar
          </button>
        </div>
      )}

      <section
        className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 sm:grid-cols-3"
        aria-label="Resumo de cotações"
      >
        {[
          { label: "Pedidos enviados", value: quotes.length, Icon: FileText, tone: "bg-blue-50 text-blue-700" },
          { label: "Em análise", value: inReviewCount, Icon: Clock3, tone: "bg-amber-50 text-amber-800" },
          { label: "Aprovadas", value: approvedCount, Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
        ].map(({ label, value, Icon, tone }) => (
          <article
            key={label}
            className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5 ${
              label === "Aprovadas" ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold leading-4 text-slate-500 sm:text-xs">
                {label}
              </p>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              {value}
            </p>
          </article>
        ))}
      </section>

      {error && !company && (
        <section className="mb-6 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-rose-800">
            Não foi possível carregar os dados da empresa.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700"
          >
            <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
          </button>
        </section>
      )}

      {company && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-3xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <FileText size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-slate-950 sm:text-base">
                Criar pedido de cotação
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {company.tradeName || company.legalName}
              </p>
            </div>
            <span
              className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${
                company.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {company.status === "ACTIVE" ? "Empresa ativa" : "Em homologação"}
            </span>
          </div>

          {!canCreate ? (
            <div className="flex flex-col items-start gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm leading-6 text-slate-600">
                {company.status !== "ACTIVE"
                  ? "A empresa precisa de estar homologada antes de poder enviar pedidos de cotação."
                  : "Apenas os membros com função de comprador ou proprietário podem criar cotações."}
              </p>
              {company.status !== "ACTIVE" && (
                <Link
                  href="/b2b/empresa"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 sm:w-auto"
                >
                  Consultar empresa <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={(event) => void submitQuote(event)} className="p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem_auto] sm:items-end">
                <label className="block min-w-0 text-xs font-bold text-slate-700">
                  Produto
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Selecionar produto</option>
                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                        disabled={draftItems.some((item) => item.productId === product.id)}
                      >
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Moeda da cotação
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as Currency)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="AOA">AOA · Kwanza</option>
                    <option value="EUR">EUR · Euro</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Quantidade
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    value={selectedQuantity}
                    onChange={(event) => setSelectedQuantity(event.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={addDraftItem}
                  disabled={!selectedProductId || !products.length}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={15} aria-hidden="true" /> Adicionar
                </button>
              </div>

              {selectedProduct && (
                <article
                  className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5 sm:p-4"
                  aria-label={`Detalhes de ${selectedProduct.name}`}
                >
                  <ProductImage
                    key={selectedProduct.imageUrl ?? "no-image"}
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="aspect-square w-24 sm:w-32"
                  />
                  <div className="min-w-0 self-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Produto selecionado
                    </p>
                    <h3 className="mt-1 text-sm font-black leading-5 text-slate-950 sm:text-base">
                      {selectedProduct.name}
                    </h3>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
                      {selectedProduct.description?.trim() ||
                        "Não existe uma descrição disponível para este produto."}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-800">
                      {selectedUnitPrice === null
                        ? `Preço sob consulta em ${currency}`
                        : `${formatMoney(selectedUnitPrice, currency)} / unidade`}
                    </p>
                  </div>
                </article>
              )}

              {!products.length && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
                  O catálogo empresarial está vazio ou indisponível. Atualize os
                  dados ou contacte a equipa comercial.
                </p>
              )}

              {draftItems.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_2rem] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                    <span>Artigo</span>
                    <span className="text-right">Quantidade</span>
                    <span className="text-right">Preço unitário</span>
                    <span className="text-right">Subtotal</span>
                    <span />
                  </div>
                  <div className="divide-y divide-slate-100">
                    {draftItems.map((item) => {
                      const product = products.find(
                        (candidate) => candidate.id === item.productId,
                      );
                      if (!product) return null;
                      const unitPrice = resolveQuoteUnitPrice(
                        product,
                        item.quantity,
                        currency,
                      );
                      return (
                        <div
                          key={item.productId}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_2rem] sm:gap-3 sm:px-4"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <ProductImage
                              key={product.imageUrl ?? "no-image"}
                              src={product.imageUrl}
                              alt=""
                              className="h-12 w-12 rounded-lg"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800">
                                {product.name}
                              </p>
                              <p className="hidden line-clamp-2 text-[10px] leading-4 text-slate-500 sm:block">
                                {product.description?.trim() ||
                                  "Sem descrição disponível."}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-500 sm:hidden">
                                {unitPrice === null
                                  ? `Sem preço em ${currency}`
                                  : `${formatMoney(unitPrice, currency)} / un.`}
                              </p>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 sm:block sm:text-right">
                            <span className="sm:hidden">Qtd.</span>
                            <input
                              aria-label={`Quantidade de ${product.name}`}
                              type="number"
                              min={1}
                              max={100000}
                              step={1}
                              value={item.quantity}
                              onChange={(event) =>
                                changeQuantity(item.productId, event.target.value)
                              }
                              className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-xs font-bold text-slate-800 sm:w-full"
                            />
                          </label>
                          <span className="hidden text-right text-xs font-medium text-slate-600 sm:block">
                            {unitPrice === null
                              ? "Sem preço"
                              : formatMoney(unitPrice, currency)}
                          </span>
                          <strong className="col-span-2 flex justify-between text-right text-xs font-black text-slate-900 sm:col-span-1 sm:block">
                            <span className="font-medium text-slate-500 sm:hidden">
                              Subtotal
                            </span>
                            {unitPrice === null
                              ? "A consultar"
                              : formatMoney(unitPrice * item.quantity, currency)}
                          </strong>
                          <button
                            type="button"
                            aria-label={`Remover ${product.name}`}
                            onClick={() =>
                              setDraftItems((items) =>
                                items.filter(
                                  (draft) => draft.productId !== product.id,
                                ),
                              )
                            }
                            className="row-start-1 col-start-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 sm:static sm:row-auto sm:col-auto sm:h-8 sm:w-8"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <span className="text-xs font-bold text-slate-600">
                      Total estimado <span className="font-normal">(sujeito a confirmação comercial)</span>
                    </span>
                    <strong className="text-sm font-black text-slate-950">
                      {formatMoney(draftTotal, currency)}
                    </strong>
                  </div>
                </div>
              )}

              <label className="mt-4 block text-xs font-bold text-slate-700">
                Observações para a equipa comercial
                <textarea
                  value={notes}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Prazo pretendido, especificações ou outras informações relevantes (opcional)"
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal leading-5 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <span className="mt-1 block text-right text-[10px] font-normal text-slate-400">
                  {notes.length}/2000
                </span>
              </label>

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-5 text-slate-500">
                  O preço final será confirmado pela equipa comercial. A moeda
                  escolhida será preservada até à encomenda.
                </p>
                <button
                  type="submit"
                  disabled={submitting || !draftItems.length}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0c1b2a] px-5 text-xs font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send size={15} aria-hidden="true" />
                  )}
                  {submitting ? "A enviar..." : "Enviar pedido"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-950 sm:text-base">
              Histórico de cotações
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Consulte artigos, valores, estado de análise e Purchase Orders.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            {quotes.length}
          </span>
        </div>

        {quotes.length ? (
          <div className="divide-y divide-slate-100">
            {quotes.map((quote) => {
              const total = quote.items.reduce(
                (sum, item) => sum + Number(item.subtotal),
                0,
              );
              const purchaseOrder = quote.purchaseOrders.find(
                (po) => po.status !== "CANCELLED",
              );
              return (
                <article
                  key={quote.id}
                  className="px-4 py-4 transition-colors hover:bg-slate-50/60 sm:px-6 sm:py-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black tracking-tight text-slate-950">
                          {quote.quoteNumber}
                        </h3>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        Enviada{" "}
                        {new Intl.DateTimeFormat("pt-PT", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(quote.createdAt))}
                        <span className="px-1.5 text-slate-300">·</span>
                        {quote.items.length}{" "}
                        {quote.items.length === 1 ? "artigo" : "artigos"}
                      </p>
                    </div>
                    <strong className="text-sm font-black text-slate-950 sm:text-right">
                      {formatMoney(total, quote.currency === "EUR" ? "EUR" : "AOA")}
                    </strong>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    <div className="hidden grid-cols-[minmax(0,1fr)_5rem_8rem_8rem] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                      <span>Artigo</span>
                      <span className="text-right">Qtd.</span>
                      <span className="text-right">Preço unitário</span>
                      <span className="text-right">Subtotal</span>
                    </div>
                    {quote.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-3 text-xs first:border-0 sm:grid-cols-[minmax(0,1fr)_5rem_8rem_8rem] sm:items-center sm:px-4"
                      >
                        <span className="min-w-0 truncate font-semibold text-slate-800">
                          {item.name}
                        </span>
                        <span className="text-right text-slate-500">
                          {item.quantity} un.
                        </span>
                        <span className="hidden text-right text-slate-600 sm:block">
                          {formatMoney(item.unitPrice, quote.currency === "EUR" ? "EUR" : "AOA")}
                        </span>
                        <span className="col-span-2 flex justify-between font-black text-slate-900 sm:col-span-1 sm:block sm:text-right">
                          <span className="font-medium text-slate-500 sm:hidden">
                            Subtotal
                          </span>
                          {formatMoney(item.subtotal, quote.currency === "EUR" ? "EUR" : "AOA")}
                        </span>
                      </div>
                    ))}
                  </div>

                  {quote.notes && (
                    <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-5 text-blue-900">
                      <strong>Observações:</strong> {quote.notes}
                    </p>
                  )}
                  {quote.version > 0 && (
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-blue-950">
                          Proposta versão {quote.version}
                        </p>
                        {quote.validUntil && (
                          <p className="text-[11px] text-blue-900">
                            Válida até{" "}
                            {new Intl.DateTimeFormat("pt-PT", {
                              dateStyle: "medium",
                            }).format(new Date(quote.validUntil))}
                          </p>
                        )}
                      </div>
                      {quote.events.find(
                        (event) =>
                          event.version === quote.version &&
                          event.action === "CUSTOMER_REQUEST_REVISION",
                      )?.note && (
                        <p className="mt-2 text-xs leading-5 text-blue-900">
                          <strong>Revisão solicitada:</strong>{" "}
                          {
                            quote.events.find(
                              (event) =>
                                event.version === quote.version &&
                                event.action === "CUSTOMER_REQUEST_REVISION",
                            )?.note
                          }
                        </p>
                      )}
                      {quote.status === "SENT" && (
                        <div className="mt-3 space-y-3 border-t border-blue-100 pt-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {["OWNER", "APPROVER"].includes(role) && (
                              <>
                                <button
                                  type="button"
                                  disabled={respondingQuoteId === quote.id}
                                  onClick={() => void respondToProposal(quote, "ACCEPT")}
                                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                                >
                                  Aceitar proposta
                                </button>
                                <button
                                  type="button"
                                  disabled={respondingQuoteId === quote.id}
                                  onClick={() => void respondToProposal(quote, "REJECT")}
                                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                                >
                                  Recusar proposta
                                </button>
                              </>
                            )}
                          </div>
                          <label className="block text-xs font-semibold text-slate-700">
                            Pedir alteração à proposta
                            <textarea
                              value={revisionNotes[quote.id] ?? ""}
                              onChange={(event) =>
                                setRevisionNotes((current) => ({
                                  ...current,
                                  [quote.id]: event.target.value,
                                }))
                              }
                              maxLength={1000}
                              rows={2}
                              placeholder="Indique os preços, quantidades ou condições que pretende rever."
                              className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={respondingQuoteId === quote.id}
                            onClick={() =>
                              void respondToProposal(quote, "REQUEST_REVISION")
                            }
                            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 transition hover:bg-blue-50 disabled:opacity-50 sm:w-auto"
                          >
                            Solicitar revisão
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {purchaseOrder && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold text-emerald-900">
                        Purchase Order {purchaseOrder.poNumber} ·{" "}
                        {formatStatus(purchaseOrder.status)}
                      </p>
                      {purchaseOrder.status === "APPROVED" &&
                      !purchaseOrder.orderId &&
                      ["OWNER", "APPROVER"].includes(role) ? (
                        <button
                          type="button"
                          disabled={respondingQuoteId === purchaseOrder.id}
                          onClick={() =>
                            void convertPurchaseOrder(purchaseOrder.id, quote.quoteNumber)
                          }
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {respondingQuoteId === purchaseOrder.id
                            ? "A formalizar..."
                            : "Formalizar encomenda"}
                        </button>
                      ) : (
                        <Link
                          href="/b2b/encomendas"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
                        >
                          Ver encomendas <ArrowRight size={13} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-10 text-center sm:px-6 sm:py-14">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileText size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-black text-slate-900">
              Ainda não existem pedidos de cotação
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
              Adicione os produtos de que precisa e acompanhe aqui a resposta da
              equipa comercial.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
