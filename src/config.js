// These endpoint URLs are public client configuration, not credentials.
// Access is enforced by Neon Managed Auth and PostgreSQL RLS.
export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || 'https://ep-tiny-butterfly-b6z34v0h.neonauth.c-2.sa-east-1.aws.neon.tech/anit_admin/auth';
export const NEON_DATA_API_URL = import.meta.env.VITE_NEON_DATA_API_URL || 'https://ep-tiny-butterfly-b6z34v0h.apirest.c-2.sa-east-1.aws.neon.tech/anit_admin/rest/v1';