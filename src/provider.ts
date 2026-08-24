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

export type CourtRef = {
  courtCode?: string;
  courtName?: string;
};

export async function resolveCourt(ref: CourtRef): Promise<string | undefined> {
  if (ref.courtCode?.trim()) return ref.courtCode.trim();
  const wanted = ref.courtName?.trim();
  if (!wanted) return undefined;

  const courts = await auction.getCourtCodes();
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
  return auction.searchProperties(input);
}

export async function getAuctionCase(input: JsonObject): Promise<JsonObject> {
  return auction.getCaseByCaseNumber(input);
}

export async function getAuctionNotices(input: JsonObject): Promise<JsonObject> {
  return auction.searchSaleNotices(input);
}

export async function getAuctionNoticeDetail(input: JsonObject): Promise<JsonObject> {
  return auction.getSaleNoticeDetail(input);
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
