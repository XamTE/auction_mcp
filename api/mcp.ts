import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { verifyBearerAuth } from '../src/auth.js';
import { buildServer } from '../src/server.js';

const mcpHandler = createMcpHandler(buildServer);
const nodeHandler = toNodeHandler(mcpHandler, {
  onerror: (error) => console.error('[mcp/vercel]', error),
});

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const auth = verifyBearerAuth(req);
  if (!auth.ok) {
    res.statusCode = auth.status;
    res.setHeader('www-authenticate', 'Bearer realm="court-auction-mcp"');
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: auth.message }));
    return;
  }

  await nodeHandler(req, res);
}
