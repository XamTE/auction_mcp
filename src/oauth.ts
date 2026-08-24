import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const OAUTH_CLIENT_ID = process.env.MCP_OAUTH_CLIENT_ID || 'chatgpt-court-auction';
export const OAUTH_SCOPE = 'auction:read';
export const OFFLINE_SCOPE = 'offline_access';

type TokenKind = 'code' | 'access' | 'refresh';

type SignedPayload = {
  typ: TokenKind;
  exp: number;
  iat: number;
  clientId: string;
  scope: string;
  redirectUri?: string;
  codeChallenge?: string;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function secret(): string | undefined {
  return process.env.MCP_AUTH_TOKEN;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}

function issue(payload: SignedPayload): string {
  const key = secret();
  if (!key) throw new Error('MCP_AUTH_TOKEN is not configured.');
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, key)}`;
}

function parse(token: string): SignedPayload | null {
  const key = secret();
  if (!key) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = sign(body, key);
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SignedPayload;
    if (!payload || typeof payload !== 'object') return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.clientId !== OAUTH_CLIENT_ID) return null;
    return payload;
  } catch {
    return null;
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function oauthConfigured(): boolean {
  return Boolean(secret());
}

export function verifyClientSecret(value: string | null | undefined): boolean {
  const key = secret();
  return Boolean(key && value && safeEqual(value, key));
}

export function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'chatgpt.com' &&
      url.pathname.startsWith('/connector/oauth/')
    );
  } catch {
    return false;
  }
}

export function normalizeScope(requested: string | null | undefined): string {
  const requestedScopes = new Set(
    String(requested || '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
  requestedScopes.add(OAUTH_SCOPE);
  const allowed = [OAUTH_SCOPE, OFFLINE_SCOPE].filter((scope) => requestedScopes.has(scope));
  return allowed.join(' ');
}

export function issueAuthorizationCode(input: {
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}): string {
  const issued = now();
  return issue({
    typ: 'code',
    iat: issued,
    exp: issued + 300,
    clientId: OAUTH_CLIENT_ID,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope: normalizeScope(input.scope),
  });
}

export function redeemAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): { scope: string } | null {
  const payload = parse(input.code);
  if (!payload || payload.typ !== 'code') return null;
  if (!payload.redirectUri || payload.redirectUri !== input.redirectUri) return null;
  if (!payload.codeChallenge || !input.codeVerifier) return null;
  const challenge = createHash('sha256').update(input.codeVerifier).digest('base64url');
  if (!safeEqual(challenge, payload.codeChallenge)) return null;
  return { scope: payload.scope };
}

export function issueAccessToken(scope: string): { accessToken: string; expiresIn: number } {
  const issued = now();
  const expiresIn = 3600;
  return {
    accessToken: issue({
      typ: 'access',
      iat: issued,
      exp: issued + expiresIn,
      clientId: OAUTH_CLIENT_ID,
      scope: normalizeScope(scope),
    }),
    expiresIn,
  };
}

export function issueRefreshToken(scope: string): string {
  const issued = now();
  return issue({
    typ: 'refresh',
    iat: issued,
    exp: issued + 60 * 60 * 24 * 30,
    clientId: OAUTH_CLIENT_ID,
    scope: normalizeScope(scope),
  });
}

export function redeemRefreshToken(token: string): { scope: string } | null {
  const payload = parse(token);
  if (!payload || payload.typ !== 'refresh') return null;
  return { scope: payload.scope };
}

export function verifyOAuthAccessToken(token: string): boolean {
  const payload = parse(token);
  if (!payload || payload.typ !== 'access') return false;
  return payload.scope.split(/\s+/).includes(OAUTH_SCOPE);
}

export function verifyLegacyBearerToken(token: string): boolean {
  return verifyClientSecret(token);
}
