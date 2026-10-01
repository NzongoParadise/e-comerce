import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(120).nullable().optional(),
  email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  taxId: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().min(2).max(80).default('Angola'),
  province: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().default(true),
});

export const supplierUpdateSchema = supplierSchema.partial();

const nullableFields = ['contactName', 'email', 'phone', 'taxId', 'province', 'city', 'address', 'notes'];

export function normalizeSupplierData<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).map(([key, fieldValue]) => [
    key,
    nullableFields.includes(key) && fieldValue === '' ? null : fieldValue,
  ])) as T;
}