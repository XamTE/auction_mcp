import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type JsonObject = Record<string, unknown>;

type CourtCodeItem = {
  code?: string;
  name?: string;
  branchName?: string;
  [key: string]: unknown;
};

type CourtCodeResponse = {
  count?: number;
  items?: CourtCodeItem[];
  [key: string]: unknown;
};

type CourtAuctionPackage = {
  searchSaleNotices: (input: JsonObject) => Promise<JsonObject>;
  getSaleNoticeDetail: (input: JsonObject, options?: JsonObject) => Promise<JsonObject>;
  getCaseByCaseNumber: (input: JsonObject) => Promise<JsonObject>;
  searchProperties: (input: JsonObject) => Promise<JsonObject>;
  getCourtCodes: (input?: JsonObject) => Promise<CourtCodeResponse>;
};

const auction = require('court-auction-notice-search') as CourtAuctionPackage;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const CACHE_MAX_ENTRIES = envInteger('COURT_AUCTION_CACHE_MAX_ENTRIES', 200, 10, 2_000);
const MIN_UPSTREAM_INTERVAL_MS = envInteger(
  'COURT_AUCTION_MIN_INTERVAL_MS',
  500,
  0,
  5_000,
);
const COURT_CODES_TTL_MS = envInteger(
  'COURT_AUCTION_COURT_CODES_TTL_MS',
  12 * 60 * 60 * 1_000,
  60_000,
  7 * 24 * 60 * 60 * 1_000,
);
const SEARCH_TTL_MS = envInteger('COURT_AUCTION_SEARCH_TTL_MS', 45_000, 0, 10 * 60_000);
const CASE_TTL_MS = envInteger('COURT_AUCTION_CASE_TTL_MS', 30_000, 0, 10 * 60_000);
const NOTICE_TTL_MS = envInteger('COURT_AUCTION_NOTICE_TTL_MS', 2 * 60_000, 0, 30 * 60_000);

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();
let upstreamQueue: Promise<void> = Promise.resolve();
let lastUpstreamStartAt = 0;

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function cacheKey(namespace: string, input: unknown): string {
  return `${namespace}:${JSON.stringify(stableValue(input))}`;
}

function pruneCache(now: number): void {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  while (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value as string | undefined;
    if (!oldest) break;
    responseCache.delete(oldest);
  }
}

async function scheduleUpstream<T>(operation: () => Promise<T>): Promise<T> {
  const result = upstreamQueue.then(async () => {
    const waitMs = Math.max(
      0,
      lastUpstreamStartAt + MIN_UPSTREAM_INTERVAL_MS - Date.now(),
    );
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
    lastUpstreamStartAt = Date.now();
    return operation();
  });

  upstreamQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function cachedUpstream<T>(
  key: string,
  ttlMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    responseCache.delete(key);
    responseCache.set(key, cached);
    return cached.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = scheduleUpstream(operation).then((value) => {
    if (ttlMs > 0) {
      pruneCache(Date.now());
      responseCache.set(key, { expiresAt: Date.now() + ttlMs, value });
    }
    return value;
  });
  inFlight.set(key, request);

  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

async function getCachedCourtCodes(): Promise<CourtCodeResponse> {
  return cachedUpstream('court-codes', COURT_CODES_TTL_MS, () => auction.getCourtCodes());
}

export type CourtRef = {
  courtCode?: string;
  courtName?: string;
};

export async function resolveCourt(ref: CourtRef): Promise<string | undefined> {
  if (ref.courtCode?.trim()) return ref.courtCode.trim();
  const wanted = ref.courtName?.trim();
  if (!wanted) return undefined;

  const courts = await getCachedCourtCodes();
  const items = Array.isArray(courts.items) ? courts.items : [];
  const exact = items.find(
    (court) => court.name === wanted || court.branchName === wanted,
  );
  if (exact?.code) return exact.code;

  const normalizedWanted = wanted.replace(/\s+/g, '');
  const partial = items.filter((court) => {
    const names = [court.name, court.branchName]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.replace(/\s+/g, ''));
    return names.some(
      (name) => name.includes(normalizedWanted) || normalizedWanted.includes(name),
    );
  });

  if (partial.length === 1 && partial[0]?.code) return partial[0].code;

  const candidates = partial
    .slice(0, 8)
    .map((court) => `${court.name ?? court.branchName ?? '이름 없음'}(${court.code ?? '?'})`)
    .join(', ');

  if (partial.length > 1) {
    throw new Error(
      `법원명이 여러 곳과 일치합니다: ${wanted}. 후보: ${candidates}`,
    );
  }

  throw new Error(`법원명을 찾지 못했습니다: ${wanted}`);
}

export async function searchAuctions(input: JsonObject): Promise<JsonObject> {
  return cachedUpstream(cacheKey('search', input), SEARCH_TTL_MS, () =>
    auction.searchProperties(input),
  );
}

export async function getAuctionCase(input: JsonObject): Promise<JsonObject> {
  return cachedUpstream(cacheKey('case', input), CASE_TTL_MS, () =>
    auction.getCaseByCaseNumber(input),
  );
}

export async function getAuctionNotices(input: JsonObject): Promise<JsonObject> {
  return cachedUpstream(cacheKey('notices', input), NOTICE_TTL_MS, () =>
    auction.searchSaleNotices(input),
  );
}

export async function getAuctionNoticeDetail(input: JsonObject): Promise<JsonObject> {
  return cachedUpstream(cacheKey('notice-detail', input), NOTICE_TTL_MS, () =>
    auction.getSaleNoticeDetail(input),
  );
}

export function sliceItems<T extends JsonObject>(result: T, maxResults: number): T {
  const items = result.items;
  if (!Array.isArray(items)) return result;
  return {
    ...result,
    returnedCount: Math.min(items.length, maxResults),
    items: items.slice(0, maxResults),
  } as T;
}
