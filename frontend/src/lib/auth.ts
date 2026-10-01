export type AppUserProfile = {
  roles?: unknown;
  accessRole?: unknown;
  isAdmin?: unknown;
  email?: string | null;
  app_metadata?: { roles?: unknown };
  accountType?: unknown;
  status?: unknown;
  b2bRequestStatus?: unknown;
};

function toNormalizedRoleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toNormalizedRoleList(entry));
  }

  if (typeof value === 'string') {
    return value
      .split(/[|,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.toLowerCase());
  }

  if (typeof value === 'object' && value !== null && 'role' in value && typeof (value as { role?: unknown }).role === 'string') {
    return toNormalizedRoleList((value as { role: string }).role);
  }

  return [];
}

export function getUserRoles(profile: AppUserProfile | null | undefined): string[] {
  const values = profile?.accessRole !== undefined
    ? [profile.accessRole]
    : [profile?.roles, profile?.app_metadata?.roles];

  const roles = values.flatMap((value) => toNormalizedRoleList(value));
  return [...new Set(roles.filter((role) => role.length > 0))];
}

export function isAdminUser(profile: AppUserProfile | null | undefined): boolean {
  if (profile?.isAdmin === true) return true;
  const roles = getUserRoles(profile);
  const hasAdminRole = roles.some((role) => ['admin', 'administrator', 'super_admin', 'super-admin'].includes(role));
  if (profile?.accessRole !== undefined) return hasAdminRole;

  const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
  const configuredAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configuredAdmins.includes(email) || hasAdminRole;
}

export function getDashboardDestination(profile: AppUserProfile | null | undefined): '/admin' | '/account' {
  return isAdminUser(profile) ? '/admin' : '/account';
}

export function isActiveWholesaleCustomer(profile: AppUserProfile | null | undefined): boolean {
  return profile?.accessRole === 'CUSTOMER'
    && profile.accountType === 'B2B'
    && profile.status === 'ACTIVE';
}

export function canRequestB2BAccount(profile: AppUserProfile | null | undefined): boolean {
  return profile?.accessRole === 'CUSTOMER'
    && profile.accountType === 'B2C'
    && profile.status === 'ACTIVE'
    && profile.b2bRequestStatus !== 'PENDING';
}
