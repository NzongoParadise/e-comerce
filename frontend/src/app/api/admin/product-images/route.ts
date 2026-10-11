import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { authenticate, errorResponse, isAdmin, rateLimit } from '@/lib/server/api';

export const runtime = 'nodejs';

const maxFileSize = 4 * 1024 * 1024;
const imageTypes = {
  'image/jpeg': { extension: 'jpg', matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', matches: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  'image/webp': { extension: 'webp', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
  'image/avif': { extension: 'avif', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' && ['avif', 'avis'].includes(String.fromCharCode(...bytes.slice(8, 12))) },
} satisfies Record<string, { extension: string; matches: (bytes: Uint8Array) => boolean }>;

export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user) return errorResponse('Authentication required', 401);
  if (!isAdmin(user)) return errorResponse('Administrator access required', 403);

  const rateLimitError = rateLimit(request, 'admin-product-image-upload', 30, 60 * 60 * 1000);
  if (rateLimitError) return rateLimitError;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('Pedido de upload inválido', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return errorResponse('Selecione um ficheiro de imagem', 400);
  if (!file.size || file.size > maxFileSize) return errorResponse('Cada imagem deve ter até 4 MB', 413);

  const imageType = imageTypes[file.type as keyof typeof imageTypes];
  if (!imageType) return errorResponse('Formato não suportado. Utilize JPEG, PNG, WebP ou AVIF.', 415);

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!imageType.matches(header)) return errorResponse('O conteúdo do ficheiro não corresponde a uma imagem válida', 415);

  const pathname = `products/${randomUUID()}.${imageType.extension}`;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: false,
        contentType: file.type,
        cacheControlMaxAge: 31536000,
      });
      return Response.json({ data: { url: blob.url, pathname: blob.pathname } }, { status: 201 });
    }

    if (process.env.NODE_ENV !== 'production') {
      const uploadDirectory = path.resolve(process.cwd(), 'public', 'uploads', 'products');
      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(path.join(uploadDirectory, path.basename(pathname)), Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
      return Response.json({ data: { url: `/uploads/products/${path.basename(pathname)}`, pathname } }, { status: 201 });
    }

    return errorResponse('O armazenamento de imagens não está configurado. Configure o Vercel Blob para continuar.', 503);
  } catch (error) {
    console.error('Error uploading product image:', error);
    return errorResponse('Não foi possível enviar a imagem. Tente novamente.', 502);
  }
}
