type AppUrlEnvironment = {
  FRONTEND_URL?: string;
  APP_URL?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
};

export function resolveAppUrl(environment: AppUrlEnvironment) {
  const configuredUrl = environment.FRONTEND_URL?.trim() || environment.APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const vercelUrl = environment.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}`;
  }

  return environment.NODE_ENV === 'production' ? null : 'http://localhost:3000';
}

export function getAppUrl() {
  return resolveAppUrl(process.env);
}
