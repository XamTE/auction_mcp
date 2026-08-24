import {
  OAUTH_CLIENT_ID,
  issueAuthorizationCode,
  isAllowedRedirectUri,
  normalizeScope,
  oauthConfigured,
} from '../../../src/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function oauthError(message: string, status = 400): Response {
  return Response.json({ error: 'invalid_request', error_description: message }, { status });
}

export async function GET(request: Request): Promise<Response> {
  if (!oauthConfigured()) {
    return oauthError('OAuth is not configured on the server.', 503);
  }

  const url = new URL(request.url);
  const responseType = url.searchParams.get('response_type');
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const scope = normalizeScope(url.searchParams.get('scope'));

  if (responseType !== 'code') return oauthError('response_type must be code.');
  if (clientId !== OAUTH_CLIENT_ID) return oauthError('Unknown OAuth client_id.');
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return oauthError('redirect_uri must be a ChatGPT connector OAuth callback URL.');
  }
  if (!state) return oauthError('state is required.');
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return oauthError('PKCE with code_challenge_method=S256 is required.');
  }

  const code = issueAuthorizationCode({ redirectUri, codeChallenge, scope });
  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  callback.searchParams.set('iss', url.origin);

  return Response.redirect(callback, 302);
}
