import { authenticate, errorResponse, isAdmin } from '@/lib/server/api';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR', 'DEBUG']).optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

type LogEntry = {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: string;
  message: string;
  details?: string;
  actor?: string;
  status: 'OK' | 'WARN' | 'CRITICAL';
};

const now = Date.now();
const logEntries: LogEntry[] = [
  {
    id: 1,
    timestamp: new Date(now - 1000 * 60 * 8).toISOString(),
    level: 'INFO',
    source: 'checkout',
    message: 'Pedido finalizado com sucesso',
    details: 'Checkout do cliente A. Silva concluído com pagamento confirmado.',
    actor: 'cliente@rubrica.ao',
    status: 'OK',
  },
  {
    id: 2,
    timestamp: new Date(now - 1000 * 60 * 26).toISOString(),
    level: 'WARN',
    source: 'inventory',
    message: 'Stock baixo em produtos críticos',
    details: '3 produtos ultrapassaram o limite mínimo de stock.',
    actor: 'admin@rubrica.ao',
    status: 'WARN',
  },
  {
    id: 3,
    timestamp: new Date(now - 1000 * 60 * 43).toISOString(),
    level: 'ERROR',
    source: 'payments',
    message: 'Falha de reconciliation de pagamento',
    details: 'Um pagamento foi marcado como pendente após timeout da API externa.',
    actor: 'integracao@rubrica.ao',
    status: 'CRITICAL',
  },
  {
    id: 4,
    timestamp: new Date(now - 1000 * 60 * 89).toISOString(),
    level: 'INFO',
    source: 'auth',
    message: 'Novo login efetuado com sucesso',
    details: 'Sessão iniciada pela conta de suporte.',
    actor: 'suporte@rubrica.ao',
    status: 'OK',
  },
  {
    id: 5,
    timestamp: new Date(now - 1000 * 60 * 120).toISOString(),
    level: 'DEBUG',
    source: 'catalog',
    message: 'Sincronização de catálogo concluída',
    details: 'Atualização de catálogos e preços concluída sem conflitos.',
    actor: 'sync-bot',
    status: 'OK',
  },
  {
    id: 6,
    timestamp: new Date(now - 1000 * 60 * 182).toISOString(),
    level: 'WARN',
    source: 'newsletter',
    message: 'Taxa de entrega de e-mail acima do esperado',
    details: 'O envio de campanhas ficou acima do limite padrão por 14%.',
    actor: 'marketing@rubrica.ao',
    status: 'WARN',
  },
  {
    id: 7,
    timestamp: new Date(now - 1000 * 60 * 248).toISOString(),
    level: 'ERROR',
    source: 'admin',
    message: 'Acesso sem permissão detetado',
    details: 'Tentativa de acesso ao painel administrativo por uma conta não autorizada.',
    actor: 'anonimo',
    status: 'CRITICAL',
  },
  {
    id: 8,
    timestamp: new Date(now - 1000 * 60 * 320).toISOString(),
    level: 'INFO',
    source: 'orders',
    message: 'Encomenda reagendada',
    details: 'Cliente alterou a data de entrega e foi registada a atualização.',
    actor: 'cliente@rubrica.ao',
    status: 'OK',
  },
];

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return errorResponse('Authentication required', 401);
  if (!isAdmin(auth)) return errorResponse('Administrator access required', 403);

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return errorResponse('Invalid log query', 400);

  const { level, source, search, page, pageSize } = parsed.data;
  let filtered = [...logEntries];

  if (level) filtered = filtered.filter((entry) => entry.level === level);
  if (source) filtered = filtered.filter((entry) => entry.source.toLowerCase() === source.toLowerCase());
  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter((entry) =>
      entry.message.toLowerCase().includes(term) ||
      entry.details?.toLowerCase().includes(term) ||
      entry.source.toLowerCase().includes(term) ||
      entry.actor?.toLowerCase().includes(term),
    );
  }

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return Response.json({
    data: {
      page,
      pageSize,
      total,
      items,
      summary: {
        info: logEntries.filter((entry) => entry.level === 'INFO').length,
        warn: logEntries.filter((entry) => entry.level === 'WARN').length,
        error: logEntries.filter((entry) => entry.level === 'ERROR').length,
        debug: logEntries.filter((entry) => entry.level === 'DEBUG').length,
      },
    },
  });
}
