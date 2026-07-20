/**
 * API Authentication helpers (for future dedicated API keys)
 * 
 * Currently the system uses JWT from the web login.
 * This file prepares the ground for proper creator API keys.
 */

export type ApiAuthResult = 
  | { ok: true; userId: string; username: string; keyId?: string }
  | { ok: false; error: string; status: number };

/**
 * Placeholder for when we implement real API keys.
 * For now, falls back to regular JWT auth.
 */
export async function requireApiAuth(req: Request): Promise<ApiAuthResult> {
  // TODO: Implement API key lookup (new model + collection)
  // For now we just tell callers to use the existing JWT flow.
  return {
    ok: false,
    error: "API keys not yet issued. Use the JWT from /api/auth/login for now.",
    status: 501,
  };
}
