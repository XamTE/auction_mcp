# court-auction-mcp

대한민국 **법원경매정보(courtauction.go.kr)** 의 부동산 경매 데이터를 MCP로 조회하는 read-only 서버입니다.

이 프로젝트는 법원 사이트 내부 WebSquare JSON 요청을 직접 다시 구현하지 않고, 해당 흐름을 감싸는 `court-auction-notice-search` 패키지를 데이터 계층으로 사용합니다. MCP 계층은 Model Context Protocol TypeScript SDK v2를 사용합니다.

## 제공 도구

| MCP tool | 기능 |
|---|---|
| `search_auctions` | 지역·가격·감정가·면적·유찰횟수·매각기일 조건검색 |
| `get_auction_case` | 법원 + 사건번호 상세조회 |
| `get_auction_schedule` | 월/일 단위 매각공고 및 선택적 상세 펼치기 |
| `get_auction_result` | 특정 사건의 진행상태와 매각기일별 결과 이력 |

> **중요:** 참고용 read-only 서버입니다. 실제 입찰 전에는 법원 원문 공고와 최신 정정·취하·연기 여부를 반드시 다시 확인하세요. 입찰·제출·결제는 지원하지 않습니다.

## 요구사항

- Node.js 20+
- 인터넷 연결
- 법원경매정보 사이트에 접근 가능한 네트워크

## 설치

```bash
npm install
```

선택적으로 로컬 Playwright fallback까지 사용하려면:

```bash
npm install rebrowser-playwright
```

## 로컬 MCP (stdio)

```bash
npm start
```

MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

## 로컬 Streamable HTTP + Bearer 인증

토큰 생성:

```bash
export MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
```

서버 실행:

```bash
npm run start:http
```

기본 엔드포인트:

```text
http://127.0.0.1:3000/mcp
```

모든 `/mcp` 요청은 아래 헤더가 필요합니다.

```text
Authorization: Bearer <MCP_AUTH_TOKEN>
```

개발 환경에서만 인증을 끄려면 `MCP_ALLOW_UNAUTHENTICATED=1`을 명시할 수 있습니다. 프로덕션에서는 사용하지 마세요.

## Vercel 배포

프로젝트에는 Vercel Function 엔드포인트가 포함되어 있습니다.

- MCP: `/api/mcp`
- 상태 확인: `/api/health`

Vercel 프로젝트 환경변수에 반드시 다음 값을 등록하세요.

```text
MCP_AUTH_TOKEN=<64자 이상 권장 랜덤 토큰>
```

배포 후 MCP 주소는 다음 형태입니다.

```text
https://YOUR_PROJECT.vercel.app/api/mcp
```

클라이언트는 Bearer 헤더와 함께 접속합니다.

```json
{
  "mcpServers": {
    "court-auction": {
      "url": "https://YOUR_PROJECT.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

실제 토큰은 GitHub 저장소에 커밋하지 마세요. `.env`와 `.vercel/`은 `.gitignore`에 포함되어 있습니다.

## Docker 배포

```bash
docker build -t court-auction-mcp .
docker run --rm -p 3000:3000 \
  -e MCP_AUTH_TOKEN="$(openssl rand -hex 32)" \
  -e MCP_ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e MCP_ALLOWED_ORIGINS=localhost,127.0.0.1 \
  court-auction-mcp
```

외부 Docker 호스팅에서는 실제 도메인을 `MCP_ALLOWED_HOSTS`/`MCP_ALLOWED_ORIGINS`에 추가하세요.

## 사용 예시

### 서울 강남구, 최저가 5억 이하, 유찰 1회 이상

`search_auctions`

```json
{
  "sido": "서울특별시",
  "sigungu_code": "11680",
  "usage_large": "건물",
  "max_price_won": 500000000,
  "min_failed_count": 1,
  "sale_from": "2026-08-24",
  "sale_to": "2026-09-30",
  "max_results": 10
}
```

### 사건 상세

`get_auction_case`

```json
{
  "court_name": "서울중앙지방법원",
  "case_number": "2024타경100001"
}
```

## 차단 방지 정책

`courtauction.go.kr`은 자동화 호출에 민감합니다. 기반 패키지는 호출 간 지연 및 차단 신호 감지를 적용합니다. 이 MCP는 `BLOCKED` 응답을 받으면 자동으로 반복 재시도하지 않습니다.

대량 수집용 크롤러보다는 대화형 조회용으로 사용하는 것을 권장합니다.

## 보안

- GitHub 저장소는 **Private** 권장
- 프로덕션 MCP는 HTTPS만 사용
- `MCP_AUTH_TOKEN`은 Vercel 환경변수 등 비밀 저장소에만 저장
- 토큰은 32바이트 이상 랜덤 값 권장
- 토큰 노출 시 즉시 회전(rotation)
- URL query string에 토큰을 넣지 않음

## 현재 범위 밖

- 자동 입찰/입찰서 제출/결제
- 동산(자동차·중기) 경매
- 매각물건명세서·현황조사서·감정평가서 PDF 다운로드
- 모든 법원의 대규모 일괄 수집

## 개발

```bash
npm run typecheck
npm run dev
```

## 데이터 및 라이브러리 출처

- 대한민국 법원경매정보 공개 화면 데이터
- `court-auction-notice-search` 0.3.3 (MIT)
- `@modelcontextprotocol/server` 2.0.0
- `@modelcontextprotocol/node` 2.0.0
