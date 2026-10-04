export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // In a real app, this might come from next-auth, cookies, or a context.
  // For this demo, we'll try to get it from localStorage if running in browser.
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('jwt_token') || '';
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token');
    }

    let message = `API error: ${response.status}`;
    try {
      const payload = await response.clone().json();
      if (payload && typeof payload === 'object') {
        const errorText = 'error' in payload && typeof payload.error === 'string' ? payload.error.trim() : '';
        if (errorText) {
          message = errorText;
        } else if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
          message = payload.message.trim();
        }
      }
    } catch {
      // Ignore non-JSON error responses and keep the generic status code message.
    }

    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}
