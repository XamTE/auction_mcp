import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '../../../src/server';
import {
  OAUTH_SCOPE,
  oauthConfigured,
  verifyLegacyBearerToken,
  verifyOAuthAccessToken,
} from '../../../src/oauth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mcp = createMcpHandler(buildServer);

function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  const metadata = `${origin}/.well-known/oauth-protected-resource`;
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: {
        'www-authenticate': `Bearer realm="court-auction-mcp", resource_metadata="${metadata}", scope="${OAUTH_SCOPE}"`,
      },
    },
  );
}

async function handler(request: Request): Promise<Response> {
  if (!oauthConfigured()) {
    return Response.json(
      { error: 'MCP_AUTH_TOKEN is not configured on the server.' },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization');
  const supplied = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (
    !supplied ||
    (!verifyLegacyBearerToken(supplied) && !verifyOAuthAccessToken(supplied))
  ) {
    return unauthorized(request);
  }

  return mcp.fetch(request);
}

export { handler as GET, handler as POST, handler as DELETE };
