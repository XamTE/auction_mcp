import { createServer as createHttpServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { verifyBearerAuth } from './auth.js';
import { buildServer } from './server.js';

const SERVER_NAME = 'court-auction-mcp';

function csvEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function runHttp(): Promise<void> {
  const port = Number(process.env.PORT ?? '3000');
  const host = process.env.HOST ?? '127.0.0.1';
  const allowUnauthenticated = process.env.MCP_ALLOW_UNAUTHENTICATED === '1';
  const allowedHosts = csvEnv('MCP_ALLOWED_HOSTS', ['localhost', '127.0.0.1', '[::1]']);
  const allowedOrigins = csvEnv('MCP_ALLOWED_ORIGINS', allowedHosts);

  const handler = createMcpHandler(buildServer);
  const nodeHandler = toNodeHandler(handler, {
    onerror: (error) => console.error('[mcp/http]', error),
  });
  const validateHost = hostHeaderValidation(allowedHosts);
  const validateOrigin = originValidation(allowedOrigins);

  const httpServer = createHttpServer((req, res) => {
    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true, service: SERVER_NAME }));
      return;
    }

    if (req.url && !req.url.startsWith('/mcp')) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (!validateHost(req, res) || !validateOrigin(req, res)) return;

    if (!allowUnauthenticated) {
      const auth = verifyBearerAuth(req);
      if (!auth.ok) {
        res.statusCode = auth.status;
        res.setHeader('www-authenticate', 'Bearer realm="court-auction-mcp"');
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: auth.message }));
        return;
      }
    }

    void nodeHandler(req, res);
  });

  httpServer.listen(port, host, () => {
    console.error(`${SERVER_NAME} listening on http://${host}:${port}/mcp`);
    console.error(`Allowed hosts: ${allowedHosts.join(', ')}`);
    console.error(`Authentication: ${allowUnauthenticated ? 'disabled' : 'Bearer token required'}`);
  });
}

if (process.argv.includes('--http')) {
  void runHttp();
} else {
  void serveStdio(buildServer);
  console.error(`${SERVER_NAME} running on stdio`);
}
