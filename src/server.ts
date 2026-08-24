import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  getAuctionCase,
  getAuctionNoticeDetail,
  getAuctionNotices,
  resolveCourt,
  searchAuctions,
  sliceItems,
} from './provider.js';

type JsonObject = Record<string, unknown>;

const SERVER_NAME = 'court-auction-mcp';
const SERVER_VERSION = '0.1.0';
const DISCLAIMER =
  '법원경매정보 공개 데이터를 조회하는 참고용 read-only 도구입니다. 실제 입찰 전에는 반드시 법원 원문 공고·물건서류와 최신 정정/취하/연기 여부를 다시 확인하세요.';

function compactObject(input: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value as object).length > 0;
      }
      return true;
    }),
  );
}

function toolSuccess(data: unknown) {
  const payload = { disclaimer: DISCLAIMER, data };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function toolError(error: unknown) {
  const err = error as { code?: string; message?: string };
  const code = err?.code ?? 'UPSTREAM_ERROR';
  let message = err?.message ?? String(error);

  if (code === 'BLOCKED') {
    message =
      '법원경매정보 사이트가 현재 이 IP의 자동화 요청을 차단했습니다. 같은 IP에서 반복 재시도하면 차단이 길어질 수 있으므로 자동 재시도하지 않았습니다.';
  }

  const payload = { error: { code, message }, disclaimer: DISCLAIMER };
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

const courtFields = {
  court_code: z
    .string()
    .optional()
    .describe('법원사무소 코드. 예: B000210. court_name보다 우선합니다.'),
  court_name: z
    .string()
    .optional()
    .describe('법원명. 예: 서울중앙지방법원. 코드를 몰라도 이름으로 조회할 수 있습니다.'),
};

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        '대한민국 법원경매정보의 부동산 경매 정보를 읽기 전용으로 조회합니다. 입찰·제출·결제 같은 행위는 하지 않습니다.',
    },
  );

  server.registerTool(
    'search_auctions',
    {
      title: '경매 물건 조건검색',
      description:
        '지역, 용도, 최저매각가, 감정평가액, 면적, 유찰횟수, 매각기일 등으로 부동산 경매 물건을 검색합니다.',
      inputSchema: z.object({
        sido: z
          .string()
          .optional()
          .describe('시도명 또는 코드. 예: 서울특별시, 경기, 11.'),
        sigungu_code: z
          .string()
          .optional()
          .describe('시군구 행정코드. 예: 강남구 11680.'),
        dong_code: z.string().optional().describe('읍면동 행정코드.'),
        usage_large: z
          .string()
          .optional()
          .describe('용도 대분류. 예: 건물/토지/기타 또는 5자리 코드.'),
        usage_medium: z
          .string()
          .optional()
          .describe('용도 중분류 이름 또는 코드. 예: 21200.'),
        usage_small: z
          .string()
          .optional()
          .describe('용도 소분류 이름 또는 코드. 예: 21201.'),
        min_price_won: z.number().nonnegative().optional().describe('최저매각가격 하한, 원.'),
        max_price_won: z.number().nonnegative().optional().describe('최저매각가격 상한, 원.'),
        min_appraisal_won: z.number().nonnegative().optional().describe('감정평가액 하한, 원.'),
        max_appraisal_won: z.number().nonnegative().optional().describe('감정평가액 상한, 원.'),
        sale_from: z.string().optional().describe('매각기일 시작일 YYYY-MM-DD.'),
        sale_to: z.string().optional().describe('매각기일 종료일 YYYY-MM-DD.'),
        min_failed_count: z.number().int().nonnegative().optional().describe('최소 유찰횟수.'),
        max_failed_count: z.number().int().nonnegative().optional().describe('최대 유찰횟수.'),
        min_area_m2: z.number().nonnegative().optional().describe('최소 면적 ㎡.'),
        max_area_m2: z.number().nonnegative().optional().describe('최대 면적 ㎡.'),
        bid_type: z
          .enum(['all', 'date', 'period'])
          .optional()
          .default('all')
          .describe('all=전체, date=기일입찰, period=기간입찰.'),
        ...courtFields,
        page: z.number().int().positive().optional().default(1),
        page_size: z
          .union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)])
          .optional()
          .default(20),
        max_results: z.number().int().min(1).max(100).optional().default(20),
      }),
    },
    async (args) => {
      try {
        const courtCode = await resolveCourt({
          courtCode: args.court_code,
          courtName: args.court_name,
        });

        const region = compactObject({
          sido: args.sido,
          sigungu: args.sigungu_code,
          dong: args.dong_code,
        });
        const usage = compactObject({
          large: args.usage_large,
          medium: args.usage_medium,
          small: args.usage_small,
        });
        const priceRange = compactObject({ min: args.min_price_won, max: args.max_price_won });
        const appraisedPriceRange = compactObject({
          min: args.min_appraisal_won,
          max: args.max_appraisal_won,
        });
        const saleDate = compactObject({ from: args.sale_from, to: args.sale_to });
        const flbdCount = compactObject({
          min: args.min_failed_count,
          max: args.max_failed_count,
        });
        const area = compactObject({ min: args.min_area_m2, max: args.max_area_m2 });

        const query = compactObject({
          region,
          usage,
          priceRange,
          appraisedPriceRange,
          saleDate,
          flbdCount,
          area,
          bidType: args.bid_type === 'all' ? undefined : args.bid_type,
          courtCode,
          page: args.page,
          pageSize: args.page_size,
          fallback: true,
          fallbackOnBlocked: false,
        });

        const result = await searchAuctions(query);
        return toolSuccess(sliceItems(result, args.max_results));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_auction_case',
    {
      title: '경매 사건 상세조회',
      description:
        '법원과 사건번호로 사건 기본정보, 물건내역, 배당요구종기, 매각기일 이력 등을 조회합니다.',
      inputSchema: z.object({
        case_number: z
          .string()
          .describe('사건번호. 예: 2024타경100001. 2024-100001 형태도 허용됩니다.'),
        ...courtFields,
      }),
    },
    async (args) => {
      try {
        const courtCode = await resolveCourt({
          courtCode: args.court_code,
          courtName: args.court_name,
        });
        if (!courtCode) throw new Error('사건 상세조회에는 court_code 또는 court_name이 필요합니다.');

        const result = await getAuctionCase({
          courtCode,
          caseNumber: args.case_number,
        });
        return toolSuccess(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_auction_schedule',
    {
      title: '경매 매각일정 조회',
      description:
        '특정 월 또는 날짜의 법원 매각공고를 조회합니다. 필요하면 공고 안의 사건/물건도 제한적으로 펼칩니다.',
      inputSchema: z.object({
        date: z
          .string()
          .describe('YYYY-MM 또는 YYYY-MM-DD. 일자를 주면 해당 월 조회 후 날짜를 필터링합니다.'),
        ...courtFields,
        bid_type: z
          .enum(['all', 'date', 'period'])
          .optional()
          .default('all'),
        expand_items: z
          .boolean()
          .optional()
          .default(false)
          .describe('true면 선택된 매각공고의 사건/물건 상세도 순차 조회합니다.'),
        max_notices: z.number().int().min(1).max(10).optional().default(5),
        max_items: z.number().int().min(1).max(50).optional().default(20),
      }),
    },
    async (args) => {
      try {
        const courtCode = await resolveCourt({
          courtCode: args.court_code,
          courtName: args.court_name,
        });
        const notices = await getAuctionNotices(
          compactObject({
            date: args.date,
            courtCode,
            bidType: args.bid_type === 'all' ? undefined : args.bid_type,
          }),
        );

        const selected = Array.isArray(notices.items)
          ? notices.items.slice(0, args.max_notices)
          : [];

        if (!args.expand_items) {
          return toolSuccess({
            ...notices,
            returnedCount: selected.length,
            items: selected,
          });
        }

        const expanded: unknown[] = [];
        let remaining = args.max_items;
        for (const notice of selected) {
          if (remaining <= 0) break;
          const detail = await getAuctionNoticeDetail(notice as JsonObject);
          const detailItems = Array.isArray(detail.items)
            ? detail.items.slice(0, remaining)
            : [];
          expanded.push({
            notice,
            detail: { ...detail, items: detailItems, returnedCount: detailItems.length },
          });
          remaining -= detailItems.length;
        }

        return toolSuccess({
          requestedDate: args.date,
          notices: selected,
          expanded,
          note: '상세 펼치기는 법원 사이트 호출량을 줄이기 위해 제한적으로 수행됩니다.',
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_auction_result',
    {
      title: '경매 사건 결과 조회',
      description:
        '특정 사건의 현재 진행상태와 매각기일별 결과 이력을 조회합니다. 사건 단위 결과 확인용입니다.',
      inputSchema: z.object({
        case_number: z.string().describe('사건번호. 예: 2024타경100001.'),
        ...courtFields,
        include_case_items: z.boolean().optional().default(false),
      }),
    },
    async (args) => {
      try {
        const courtCode = await resolveCourt({
          courtCode: args.court_code,
          courtName: args.court_name,
        });
        if (!courtCode) throw new Error('결과 조회에는 court_code 또는 court_name이 필요합니다.');

        const result = await getAuctionCase({
          courtCode,
          caseNumber: args.case_number,
        });

        const summarized = {
          found: result.found,
          status: result.status,
          message: result.message,
          caseInfo: result.caseInfo,
          claimDeadline: result.claimDeadline,
          schedule: result.schedule,
          items: args.include_case_items ? result.items : undefined,
        };
        return toolSuccess(summarized);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}
