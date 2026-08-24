import { createRequire } from 'node:module';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const require = createRequire(import.meta.url);
const auction = require('court-auction-notice-search') as {
  searchProperties: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const BASE = 'https://www.courtauction.go.kr';
const WARMUP = '/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml&pgjId=151F00';

function errInfo(error: unknown) {
  const err = error as Error & {
    code?: string;
    statusCode?: number;
    cause?: { name?: string; code?: string; message?: string };
  };
  return {
    name: err.name,
    code: err.code ?? null,
    statusCode: err.statusCode ?? null,
    message: err.message,
    causeName: err.cause?.name ?? null,
    causeCode: err.cause?.code ?? null,
    causeMessage: err.cause?.message ?? null,
  };
}

export async function GET(): Promise<Response> {
  const result: Record<string, unknown> = {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${BASE}${WARMUP}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        Origin: BASE,
        Referer: `${BASE}${WARMUP}`,
        'X-Requested-With': 'XMLHttpRequest',
        submissionid: 'mf_wfm_mainFrame_sbm_selectGdsDtlSrch',
        'sc-userid': 'SYSTEM',
      },
    });
    result.packageStyleWarmup = {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      hasSetCookie: Boolean(response.headers.get('set-cookie')),
    };
  } catch (error) {
    result.packageStyleWarmup = { ok: false, error: errInfo(error) };
  } finally {
    clearTimeout(timer);
  }

  try {
    const search = await auction.searchProperties({
      page: 1,
      pageSize: 10,
      fallback: false,
      timeoutMs: 15000,
      includeRaw: false,
    });
    const items = Array.isArray(search.items) ? search.items : [];
    result.packageSearch = {
      ok: true,
      count: typeof search.count === 'number' ? search.count : null,
      returned: items.length,
    };
  } catch (error) {
    result.packageSearch = { ok: false, error: errInfo(error) };
  }

  return Response.json(result, {
    headers: { 'cache-control': 'no-store' },
  });
}
