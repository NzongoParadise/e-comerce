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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('jwt_token');
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
