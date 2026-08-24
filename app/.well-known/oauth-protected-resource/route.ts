import { OAUTH_SCOPE } from '../../../src/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ['header'],
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}
