import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

router.get('/reverse', async (req: Request, res: Response) => {
  const parsed = coordinatesSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid coordinates' });

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(parsed.data.latitude),
      lon: String(parsed.data.longitude),
      zoom: '18',
      addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': 'TechGlobal/1.0 contact@techglobal.ao' },
    });

    if (!response.ok) return res.status(502).json({ error: 'Geocoding service unavailable' });
    const result = await response.json() as { display_name?: string; address?: Record<string, string> };
    const address = result.address || {};
    return res.json({
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
    return res.status(502).json({ error: 'Unable to resolve location' });
  }
});

export default router;
