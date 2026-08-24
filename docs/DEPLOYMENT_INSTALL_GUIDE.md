# 법원경매 MCP 배포 · 설치 · 사용 가이드

> 프로젝트: 대한민국 대법원 법원경매정보를 읽기 전용으로 조회하는 개인 MCP 서버  
> 배포 방식: GitHub Private Repository + Vercel + OAuth  
> MCP 엔드포인트: `https://auction-mcpa.vercel.app/api/mcp`

---

## 1. 전체 구조

이 프로젝트는 다음 구조로 사용합니다.

```text
대법원 법원경매정보
        ↓
court-auction-notice-search
        ↓
Private GitHub Repository
XamTE/auction_mcp
        ↓
Vercel
https://auction-mcpa.vercel.app
        ↓
MCP endpoint
https://auction-mcpa.vercel.app/api/mcp
        ↓
OAuth
        ↓
ChatGPT Custom MCP App
```

주요 특징:

- GitHub 저장소는 **비공개(private)**
- 외부에는 소스코드가 아니라 **MCP URL만 노출**
- ChatGPT에서는 **OAuth 인증**
- 기존 MCP 클라이언트에서는 필요 시 **고정 Bearer Token 방식도 사용 가능**
- 경매 조회는 **읽기 전용**
- 입찰, 결제, 제출 기능 없음
- CAPTCHA 우회 없음
- 대법원 사이트 차단 시 공격적인 자동 재시도 없음

---

# 2. GitHub 저장소

저장소:

```text
https://github.com/XamTE/auction_mcp
```

권장 상태:

```text
Visibility: Private
Default branch: main
```

주요 파일 구조 예시:

```text
auction_mcp/
├─ app/
│  ├─ api/
│  │  ├─ health/
│  │  │  └─ route.ts
│  │  ├─ mcp/
│  │  │  └─ route.ts
│  │  ├─ oauth-authorization-server/
│  │  │  └─ route.ts
│  │  └─ oauth-protected-resource/
│  │     └─ route.ts
│  └─ oauth/
│     ├─ authorize/
│     │  └─ route.ts
│     └─ token/
│        └─ route.ts
├─ src/
│  ├─ oauth.ts
│  ├─ provider.ts
│  ├─ provider.js
│  └─ server.ts
├─ next.config.ts
├─ package.json
├─ tsconfig.json
└─ vercel.json
```

---

# 3. MCP에서 제공하는 도구

현재 MCP 서버는 아래 4개 읽기 전용 도구를 제공합니다.

## `search_auctions`

경매 물건 검색.

중요 동작:

```text
"경기" 입력은 "경기도"로 자동 정규화됨
검색 응답은 후보 목록이며 최종 가격 확인용이 아님
가격·보증금·매각기일을 답하기 전 후보별 get_auction_case 호출 필요
```

법원 검색색인의 갱신 시점이나 묶음물건 때문에 목록의 가격 상한 필터가 개별
물건에 엄격히 적용되지 않거나 목록 최저가가 최신 공고보다 이전 회차일 수 있습니다.
검색 응답의 `guidance.requiredFollowUpTool`과 안내 문구를 따릅니다.

예시 요청:

```text
서울특별시 경매 물건 5개 찾아줘
```

가능한 필터 예시:

- 지역
- 용도
- 최저가
- 감정가
- 매각기일
- 유찰 횟수
- 면적
- 입찰 방식
- 법원

---

## `get_auction_case`

사건번호 기준 상세 조회.

응답의 다음 경로에 최신 공고 기준 확인값이 함께 제공됩니다.

```text
data.verification.currentSaleTerms[]
```

주요 필드:

```text
saleDate
minimumSalePriceWon
depositRatePercent
calculatedDepositWon
remarks
```

검색목록과 값이 다르면 이 값을 우선하되, 실제 입찰 전에는 법원 원문을 다시
확인합니다.

예시:

```text
서울중앙지방법원 2025타경12345 사건 상세 조회해줘
```

---

## `get_auction_schedule`

매각 일정 / 공고 조회.

예시:

```text
이번 달 서울중앙지방법원 경매 일정 알려줘
```

---

## `get_auction_result`

사건 상태 / 매각 결과 조회.

예시:

```text
2025타경12345 사건 결과 알려줘
```

---

# 4. Vercel 배포

## 4.1 Vercel에서 GitHub 저장소 Import

Vercel Dashboard에서:

```text
Add New...
→ Project
→ Import Git Repository
→ XamTE/auction_mcp
```

설정:

```text
Framework Preset:
Next.js

Root Directory:
비워둠

Build Command:
자동 설정 그대로

Output Directory:
자동 설정 그대로
```

그 다음 `Deploy`.

---

# 5. 필수 환경변수

Vercel 프로젝트:

```text
Settings
→ Environment Variables
```

다음 환경변수를 추가합니다.

```text
MCP_AUTH_TOKEN
```

값은 충분히 긴 랜덤 문자열을 사용합니다.

예:

```text
openssl rand -hex 32
```

결과는 약 64자리 hexadecimal 문자열입니다.

예시 형식:

```text
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 중요

절대로 다음 위치에 토큰을 저장하지 않습니다.

```text
GitHub source
README.md
.env committed file
공개 문서
스크린샷
공개 채팅
```

권장 적용 대상:

```text
Production
Preview
```

---

# 6. Vercel 정상 배포 확인

## Health Check

브라우저에서:

```text
https://auction-mcpa.vercel.app/api/health
```

정상 응답:

```json
{
  "ok": true,
  "service": "court-auction-mcp"
}
```

---

## MCP 인증 확인

브라우저에서:

```text
https://auction-mcpa.vercel.app/api/mcp
```

토큰 없이 접속하면 정상적으로:

```json
{
  "error": "Unauthorized"
}
```

가 나타나야 합니다.

이 응답은 오류가 아니라 **인증이 정상 작동 중이라는 뜻**입니다.

---

# 7. OAuth 구성

ChatGPT Custom MCP는 일반 고정 Bearer 입력 UI 대신 OAuth 연결을 사용합니다.

현재 서버 OAuth 구성:

```text
Authorization URL
https://auction-mcpa.vercel.app/oauth/authorize

Token URL
https://auction-mcpa.vercel.app/oauth/token

Authorization Server
https://auction-mcpa.vercel.app

MCP Resource
https://auction-mcpa.vercel.app/api/mcp
```

OAuth Client ID:

```text
chatgpt-court-auction
```

OAuth Client Secret:

```text
Vercel의 MCP_AUTH_TOKEN 실제 값
```

토큰 엔드포인트 인증 방식:

```text
client_secret_post
```

---

# 8. OAuth Scope

ChatGPT 설정에서는 다음처럼 입력하는 것을 권장합니다.

## Base Scope / 기초 범위

```text
offline_access
```

## Default Scope / 기본 범위

```text
auction:read
```

의미:

```text
auction:read
→ 법원경매 데이터 읽기

offline_access
→ refresh token을 사용하여 연결 유지
```

---

# 9. PKCE

ChatGPT OAuth는 PKCE S256을 요구합니다.

OAuth Authorization Server Metadata:

```text
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server
```

정상 응답에는 반드시 다음 내용이 있어야 합니다.

```json
{
  "code_challenge_methods_supported": ["S256"]
}
```

현재 서버가 광고하는 핵심 OAuth 기능:

```text
response_types_supported:
- code

grant_types_supported:
- authorization_code
- refresh_token

code_challenge_methods_supported:
- S256

token_endpoint_auth_methods_supported:
- client_secret_post
- client_secret_basic

scopes_supported:
- auction:read
- offline_access
```

---

# 10. OAuth Protected Resource Metadata

MCP 리소스 정보:

```text
https://auction-mcpa.vercel.app/.well-known/oauth-protected-resource
```

이 메타데이터는 ChatGPT에게:

```text
이 MCP 서버가 어떤 OAuth 서버를 사용하는지
어떤 scope가 필요한지
Bearer Token을 어디에 보내는지
```

를 알려주는 용도입니다.

---

# 11. ChatGPT에 MCP 설치

ChatGPT 웹에서 Developer Mode를 활성화한 뒤 Custom MCP App을 생성합니다.

대략적인 메뉴 경로:

```text
Settings
→ Apps
→ Advanced Settings
→ Developer Mode ON
```

그 다음:

```text
Apps
→ Create
```

---

# 12. ChatGPT MCP 기본 설정

이름 예시:

```text
법원 경매 mcp
```

MCP URL:

```text
https://auction-mcpa.vercel.app/api/mcp
```

인증:

```text
OAuth
```

---

# 13. ChatGPT OAuth 고급 설정

## 등록 방법

```text
사용자 정의 OAuth 클라이언트
```

## OAuth Client ID

```text
chatgpt-court-auction
```

## OAuth Client Secret

```text
Vercel MCP_AUTH_TOKEN 값
```

## Token Endpoint Authentication Method

```text
client_secret_post
```

## Base Scope

```text
offline_access
```

## Default Scope

```text
auction:read
```

## Authorization URL

```text
https://auction-mcpa.vercel.app/oauth/authorize
```

## Token URL

```text
https://auction-mcpa.vercel.app/oauth/token
```

## Registration URL

비워둡니다.

```text
(empty)
```

Dynamic Client Registration을 사용하지 않기 때문에 필요 없습니다.

## Authorization Server Base

```text
https://auction-mcpa.vercel.app
```

## Resource

```text
https://auction-mcpa.vercel.app/api/mcp
```

## OIDC

```text
OFF
```

OIDC는 현재 사용하지 않습니다.

---

# 14. DCR / CIMD 경고

ChatGPT UI에서 다음과 비슷한 경고가 보여도 괜찮습니다.

```text
DCR을 사용할 수 없음
CIMD를 사용할 수 없음
```

현재 방식은:

```text
사용자 정의 OAuth 클라이언트
```

이므로 Dynamic Client Registration이나 CIMD가 필요하지 않습니다.

---

# 15. ChatGPT 연결 성공 확인

정상적으로 설치되면 앱 정보 화면에 다음 내용이 표시됩니다.

```text
URL
https://auction-mcpa.vercel.app/api/mcp

인증 지원됨
OAuth

사용한 인증
OAuth
```

이 상태라면 OAuth 연결 자체는 성공한 것입니다.

---

# 16. 액션 새로고침

앱 화면에서:

```text
새로 고침
```

을 누릅니다.

정상이라면 다음 4개 Action / Tool이 나타나야 합니다.

```text
search_auctions
get_auction_case
get_auction_schedule
get_auction_result
```

만약:

```text
아직 사용할 수 있는 앱 액션이 없습니다.
```

가 보이면 먼저 `새로 고침`을 누릅니다.

OAuth 설치가 끝난 직후에는 도구 목록 반영이 늦을 수 있습니다.

---

# 17. ChatGPT 실제 사용법

새 채팅에서 법원 경매 MCP 앱을 선택하고 자연어로 요청합니다.

## 기본 검색

```text
서울 지역 법원경매 물건 5개 찾아줘
```

## 아파트 검색

```text
서울 아파트 경매 중 최저매각가격 5억 이하 물건 찾아줘
```

## 지역 검색

```text
경기도 성남시 경매 물건 10개 찾아줘
```

## 유찰 조건

```text
서울에서 2회 이상 유찰된 아파트 경매 찾아줘
```

## 사건 상세

```text
서울중앙지방법원 2025타경12345 사건 상세 알려줘
```

## 일정 검색

```text
이번 달 서울중앙지방법원 부동산 경매 일정 알려줘
```

## 결과 검색

```text
2025타경12345 사건의 매각 결과 확인해줘
```

---

# 18. 일반 MCP 클라이언트에서 사용하는 방법

ChatGPT 외의 MCP 클라이언트에서 custom header를 지원한다면 기존 고정 Bearer 방식도 사용할 수 있습니다.

예:

```json
{
  "mcpServers": {
    "court-auction": {
      "url": "https://auction-mcpa.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

`YOUR_MCP_AUTH_TOKEN`에는 Vercel 환경변수의 실제 값을 넣습니다.

---

# 19. 실제 법원 사이트 통신 확인 결과

Vercel 서버에서 법원 사이트 연결을 진단한 결과:

```text
Warmup request:
HTTP 200

Set-Cookie:
수신 성공

Actual search:
10건 요청 / 10건 반환 성공
```

즉 현재 확인된 범위에서는:

```text
Vercel
→ 대법원 법원경매정보
```

실제 검색이 정상 작동합니다.

이전 GitHub Actions 환경에서 발생했던 `NETWORK_ERROR`는 운영 Vercel 환경에서는 재현되지 않았습니다.

---

# 20. 빌드 검증

GitHub 쪽에서는 다음 순서의 검증을 수행했습니다.

```text
npm install
npm run typecheck
next build
```

최종적으로 Next.js production build가 통과한 상태입니다.

---

# 21. Vercel에서 패키지 번들링 문제

`court-auction-notice-search` 패키지는 선택적으로 Playwright 계열 런타임을 참조할 수 있습니다.

Vercel/Turbopack이 해당 선택적 의존성을 강제로 번들링하려다 오류가 발생할 수 있기 때문에 `next.config.ts`에서 external package 처리합니다.

예:

```ts
serverExternalPackages: [
  'court-auction-notice-search',
  'k-skill-browser-runtime',
  'playwright-core',
  'rebrowser-playwright',
]
```

---

# 22. .well-known OAuth Rewrite

Next.js/Vercel에서 `.well-known` 경로를 안정적으로 노출하기 위해 rewrite를 사용합니다.

개념:

```text
/.well-known/oauth-authorization-server
→ /api/oauth-authorization-server

/.well-known/oauth-protected-resource
→ /api/oauth-protected-resource
```

이 설정 덕분에 ChatGPT가 OAuth metadata를 정상 조회할 수 있습니다.

---

# 23. OAuth 오류: PKCE S256

과거 발생했던 오류:

```text
OAuth authorization server metadata must advertise PKCE support with
code_challenge_methods_supported containing S256.
```

확인해야 할 주소:

```text
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server
```

정상:

```json
"code_challenge_methods_supported": ["S256"]
```

보인다면 해결된 상태입니다.

---

# 24. OAuth 오류가 다시 날 때

다음 순서로 확인합니다.

1. 브라우저에서 metadata URL 확인

```text
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server
```

2. `S256` 포함 여부 확인

3. Vercel latest deployment가 Ready인지 확인

4. ChatGPT의 MCP 생성 화면을 완전히 닫고 다시 열기

5. 다시 생성 또는 새로 고침

ChatGPT 쪽에서 이전 OAuth metadata를 잠시 캐시할 수 있습니다.

---

# 25. 액션이 나타나지 않을 때

앱 설치가 됐는데:

```text
아직 사용할 수 있는 앱 액션이 없습니다.
```

가 보이면 다음을 확인합니다.

## 1. 앱 화면에서 새로 고침

```text
새로 고침
```

## 2. MCP URL 확인

```text
https://auction-mcpa.vercel.app/api/mcp
```

## 3. OAuth 인증 상태 확인

앱 정보에:

```text
인증 지원됨: OAuth
사용한 인증: OAuth
```

가 보이는지 확인.

## 4. 서버 health 확인

```text
https://auction-mcpa.vercel.app/api/health
```

## 5. unauthenticated MCP 확인

```text
https://auction-mcpa.vercel.app/api/mcp
```

정상:

```json
{"error":"Unauthorized"}
```

---

# 26. Vercel 자동배포

GitHub `main` branch에 commit이 올라가면 Vercel Git Integration을 통해 자동으로 새 배포가 생성됩니다.

일반 흐름:

```text
GitHub main push
→ Vercel detects commit
→ Next.js build
→ Production Deployment
→ auction-mcpa.vercel.app 갱신
```

코드 변경 직후에는 몇 초~몇 분 정도 이전 버전이 보일 수 있습니다.

---

# 27. 수정 배포 후 확인 순서

매번 코드를 수정한 뒤에는 다음 순서로 확인하는 것을 권장합니다.

```text
1. Vercel Deployment = Ready
2. /api/health = 200
3. /.well-known/oauth-authorization-server 확인
4. /api/mcp = Unauthorized
5. ChatGPT 앱 새로 고침
6. 도구 4개 확인
7. 실제 search_auctions 호출
```

---

# 28. 보안 권장사항

## GitHub

```text
Private Repository 유지
```

## MCP_AUTH_TOKEN

다음 상황에서는 반드시 새 토큰으로 교체합니다.

```text
토큰이 채팅에 노출됨
토큰이 GitHub에 commit됨
스크린샷에 값이 보임
공개 문서에 기록됨
신뢰하지 않는 사람에게 전달됨
```

교체:

```text
Vercel
→ Project
→ Settings
→ Environment Variables
→ MCP_AUTH_TOKEN 변경
→ Redeploy
```

OAuth access token과 refresh token도 `MCP_AUTH_TOKEN`을 기반으로 서명되므로, 이 값을 변경하면 기존 토큰을 사실상 무효화할 수 있습니다.

---

# 29. 다른 사람에게 MCP를 공유하는 경우

현재 OAuth 방식은 특정 ChatGPT custom client 설정을 전제로 합니다.

다른 사용자에게 단순 공유하려면 다음 중 하나를 선택합니다.

## 방법 A — 각 사용자 ChatGPT에 동일 OAuth Client 설정

필요 정보:

```text
MCP URL
OAuth Client ID
OAuth Client Secret
OAuth endpoint
scope
```

이 방식은 Client Secret 공유가 필요하므로 소수의 신뢰된 사용자에게만 권장합니다.

## 방법 B — 향후 사용자별 OAuth 계정 시스템 추가

더 많은 사용자에게 서비스하려면:

```text
사용자 로그인
개별 OAuth Client
DB 기반 authorization code
DB 기반 refresh token
token revoke
사용자별 접근제어
```

같은 구조로 발전시키는 것이 더 안전합니다.

---

# 30. 읽기 전용 정책

이 MCP는 법원경매 데이터 조회용입니다.

의도적으로 제공하지 않는 기능:

```text
입찰
입찰서 제출
결제
보증금 납부
자동 신청
CAPTCHA 우회
사이트 차단 우회
반복 공격 요청
```

---

# 31. 법원 데이터 사용 주의

MCP에서 반환하는 결과는 편의를 위한 조회 결과입니다.

실제 입찰이나 투자 판단 전에는 반드시 대법원 법원경매정보 원문을 다시 확인합니다.

특히 다음 항목은 원문 확인 권장:

```text
매각기일
최저매각가격
감정평가액
유찰횟수
물건 상태
사건번호
법원/담당계
매각결과
변경/취소 여부
```

---

# 32. 최종 주소 요약

## Service

```text
https://auction-mcpa.vercel.app
```

## Health

```text
https://auction-mcpa.vercel.app/api/health
```

## MCP

```text
https://auction-mcpa.vercel.app/api/mcp
```

## OAuth Authorization

```text
https://auction-mcpa.vercel.app/oauth/authorize
```

## OAuth Token

```text
https://auction-mcpa.vercel.app/oauth/token
```

## Authorization Server Metadata

```text
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server
```

## Protected Resource Metadata

```text
https://auction-mcpa.vercel.app/.well-known/oauth-protected-resource
```

## GitHub

```text
https://github.com/XamTE/auction_mcp
```

---

# 33. ChatGPT 설정값 요약

```text
App Name:
법원 경매 mcp

MCP URL:
https://auction-mcpa.vercel.app/api/mcp

Authentication:
OAuth

OAuth Registration Method:
사용자 정의 OAuth 클라이언트

Client ID:
chatgpt-court-auction

Client Secret:
Vercel MCP_AUTH_TOKEN

Token Endpoint Auth:
client_secret_post

Base Scope:
offline_access

Default Scope:
auction:read

Authorization URL:
https://auction-mcpa.vercel.app/oauth/authorize

Token URL:
https://auction-mcpa.vercel.app/oauth/token

Registration URL:
빈 값

Authorization Server:
https://auction-mcpa.vercel.app

Resource:
https://auction-mcpa.vercel.app/api/mcp

OIDC:
OFF
```

---

# 34. 최종 정상 상태 체크리스트

아래가 모두 만족하면 정상 완료입니다.

```text
[ ] GitHub repository private
[ ] Vercel deployment Ready
[ ] /api/health → {"ok":true}
[ ] /api/mcp without auth → Unauthorized
[ ] OAuth metadata → S256 확인
[ ] ChatGPT 앱 → OAuth 인증됨
[ ] ChatGPT 앱 → MCP URL 정상
[ ] 새로 고침 후 MCP tool 4개 표시
[ ] search_auctions 실제 호출 성공
[ ] 법원 데이터 실제 반환
```

---

# 35. 다음 유지보수 시 참고

코드 변경 후 문제가 발생하면 먼저 아래 순서로 문제를 분리합니다.

```text
빌드 문제?
→ next build

Vercel 문제?
→ /api/health

OAuth 문제?
→ /.well-known/oauth-authorization-server

MCP 인증 문제?
→ /api/mcp Unauthorized 응답

도구 등록 문제?
→ tools/list

법원 사이트 문제?
→ search_auctions 실제 호출
```

이 순서로 보면 원인을 빠르게 분리할 수 있습니다.

---

## 끝

현재 목표 구조는 다음과 같습니다.

```text
Private Source
+ Vercel
+ OAuth
+ ChatGPT MCP
+ Read-only Court Auction Search
```

실제 입찰 판단 전에는 언제나 대법원 법원경매정보 원문을 최종 기준으로 사용하세요.
