import {
  OAUTH_CLIENT_ID,
  issueAccessToken,
  issueRefreshToken,
  oauthConfigured,
  redeemAuthorizationCode,
  redeemRefreshToken,
  verifyClientSecret,
} from '../../../src/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenError(error: string, description: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

function parseBasicAuth(header: string | null): { clientId?: string; clientSecret?: string } {
  if (!header?.startsWith('Basic ')) return {};
  try {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const index = decoded.indexOf(':');
    if (index < 0) return {};
    return {
      clientId: decodeURIComponent(decoded.slice(0, index)),
      clientSecret: decodeURIComponent(decoded.slice(index + 1)),
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!oauthConfigured()) {
    return tokenError('server_error', 'OAuth is not configured on the server.', 503);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return tokenError('invalid_request', 'Content-Type must be application/x-www-form-urlencoded.');
  }

  const body = new URLSearchParams(await request.text());
  const basic = parseBasicAuth(request.headers.get('authorization'));
  const clientId = basic.clientId || body.get('client_id') || undefined;
  const clientSecret = basic.clientSecret || body.get('client_secret') || undefined;

  if (clientId !== OAUTH_CLIENT_ID || !verifyClientSecret(clientSecret)) {
    return tokenError('invalid_client', 'Invalid OAuth client credentials.', 401);
  }

  const grantType = body.get('grant_type');

  if (grantType === 'authorization_code') {
    const code = body.get('code');
    const redirectUri = body.get('redirect_uri');
    const codeVerifier = body.get('code_verifier');
    if (!code || !redirectUri || !codeVerifier) {
      return tokenError('invalid_request', 'code, redirect_uri, and code_verifier are required.');
    }

    const redeemed = redeemAuthorizationCode({ code, redirectUri, codeVerifier });
    if (!redeemed) return tokenError('invalid_grant', 'Invalid or expired authorization code.');

    const access = issueAccessToken(redeemed.scope);
    return Response.json(
      {
        access_token: access.accessToken,
        token_type: 'Bearer',
        expires_in: access.expiresIn,
        refresh_token: issueRefreshToken(redeemed.scope),
        scope: redeemed.scope,
      },
      { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
    );
  }

  if (grantType === 'refresh_token') {
    const refreshToken = body.get('refresh_token');
    if (!refreshToken) return tokenError('invalid_request', 'refresh_token is required.');
    const redeemed = redeemRefreshToken(refreshToken);
    if (!redeemed) return tokenError('invalid_grant', 'Invalid or expired refresh token.');

    const access = issueAccessToken(redeemed.scope);
    return Response.json(
      {
        access_token: access.accessToken,
        token_type: 'Bearer',
        expires_in: access.expiresIn,
        refresh_token: issueRefreshToken(redeemed.scope),
        scope: redeemed.scope,
      },
      { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
    );
  }

  return tokenError('unsupported_grant_type', 'Supported grant types: authorization_code, refresh_token.');
}
