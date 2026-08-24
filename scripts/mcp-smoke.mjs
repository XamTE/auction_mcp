import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = new URL(process.env.MCP_TEST_URL ?? 'http://127.0.0.1:3000/api/mcp');
const token = process.env.MCP_AUTH_TOKEN ?? 'ci-smoke-token';

const client = new Client({ name: 'court-auction-smoke', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(url, {
  authProvider: { token: async () => token },
});

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  const expected = [
    'get_auction_case',
    'get_auction_result',
    'get_auction_schedule',
    'search_auctions',
  ].sort();
  assert.deepEqual(names, expected, `Unexpected tool list: ${JSON.stringify(names)}`);

  console.log('SERVER_VERSION', JSON.stringify(client.getServerVersion()));
  console.log('TOOLS', JSON.stringify(names));

  const result = await client.callTool({
    name: 'search_auctions',
    arguments: {
      sale_from: '2026-08-24',
      sale_to: '2026-09-30',
      page: 1,
      page_size: 10,
      max_results: 1,
    },
  });

  console.log('SEARCH_IS_ERROR', Boolean(result.isError));
  console.log('SEARCH_RESULT', JSON.stringify(result));
} finally {
  await client.close().catch(() => {});
}
