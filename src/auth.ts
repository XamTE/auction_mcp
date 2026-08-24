import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; message: string };

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyBearerAuth(
  request: Pick<IncomingMessage, 'headers'>,
  expectedToken = process.env.MCP_AUTH_TOKEN,
): AuthResult {
  if (!expectedToken) {
    return {
      ok: false,
      status: 500,
      message: 'MCP_AUTH_TOKEN is not configured on the server.',
    };
  }

  const raw = request.headers.authorization;
  const authorization = Array.isArray(raw) ? raw[0] : raw;
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Bearer token required.' };
  }

  const supplied = authorization.slice('Bearer '.length).trim();
  if (!supplied || !constantTimeEqual(supplied, expectedToken)) {
    return { ok: false, status: 401, message: 'Invalid bearer token.' };
  }

  return { ok: true };
}
