import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '../../../src/server.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mcp = createMcpHandler(buildServer);

function unauthorized(): Response {
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: {
        'www-authenticate': 'Bearer realm="court-auction-mcp"',
      },
    },
  );
}

async function handler(request: Request): Promise<Response> {
  const token = process.env.MCP_AUTH_TOKEN;

  if (!token) {
    return Response.json(
      { error: 'MCP_AUTH_TOKEN is not configured on the server.' },
      { status: 503 },
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return unauthorized();
  }

  return mcp.fetch(request);
}

export { handler as GET, handler as POST, handler as DELETE };
