import { errorResponse } from '@/lib/server/api';
import { z } from 'zod';

const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = coordinatesSchema.safeParse(params);
  if (!parsed.success) return errorResponse('Invalid coordinates', 400);

  try {
    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: String(parsed.data.latitude),
      lon: String(parsed.data.longitude),
      zoom: '18',
      addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
      headers: { 'User-Agent': 'RUBRICA DILIGENTE (SU), LDA/1.0 contact@techglobal.ao' },
    });
    if (!response.ok) return errorResponse('Geocoding service unavailable', 502);
    const result = await response.json() as { display_name?: string; address?: Record<string, string> };
    const address = result.address || {};
    return Response.json({
      data: {
        displayName: result.display_name || 'Localização encontrada',
        city: address.city || address.town || address.village || address.municipality || '',
        region: address.state || address.region || '',
        country: address.country || '',
        postcode: address.postcode || '',
      },
    });
  } catch (error) {
    console.error('Error resolving location:', error);
    return errorResponse('Unable to resolve location', 502);
  }
}