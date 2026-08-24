# 법원경매 MCP 설치 에이전트 지침

> 이 문서는 `docs/DEPLOYMENT_INSTALL_GUIDE.md`와 **함께 첨부하여 Codex/GPT 같은 작업 에이전트에게 설치·배포·검증을 맡기기 위한 실행 지침**입니다.
>
> 목표: 사용자가 직접 해야 하는 로그인, 비밀값 입력, OAuth 승인 같은 단계만 최소화하고, 나머지 코드 확인·수정·빌드·배포·검증은 에이전트가 가능한 범위에서 직접 수행하도록 합니다.

---

## 1. 작업 시작 시 반드시 할 일

1. 먼저 `DEPLOYMENT_INSTALL_GUIDE.md` 전체를 읽는다.
2. 이어서 이 `AGENTS.md`를 읽는다.
3. 저장소와 배포 환경의 **현재 상태를 실제로 확인**한 뒤 작업한다.
4. 문서 내용이 현재 코드/플랫폼 상태와 다르면 문서보다 실제 상태를 우선하되, 차이를 사용자에게 명확히 설명한다.
5. 단순 안내만 하지 말고, 사용 가능한 도구가 있다면 가능한 작업은 직접 실행한다.

권장 시작 문구:

```text
첨부된 DEPLOYMENT_INSTALL_GUIDE.md와 AGENTS.md를 기준으로 설치를 진행해줘.
가능한 작업은 직접 수행하고, 로그인·비밀값 입력·OAuth 승인처럼 내가 직접 해야 하는 단계에서만 멈춰서 정확히 무엇을 해야 하는지 알려줘.
각 단계가 끝날 때마다 실제 동작을 검증하고, 실패하면 로그를 확인해서 수정해줘.
```

---

## 2. 프로젝트 목표

이 프로젝트는 대한민국 대법원 법원경매정보를 조회하는 **읽기 전용 MCP 서버**입니다.

최종 목표 구조:

```text
Private GitHub Repository
        ↓
Vercel Deployment
        ↓
OAuth-protected MCP endpoint
        ↓
ChatGPT Custom MCP App
```

현재 기준 핵심 주소:

```text
GitHub:
https://github.com/XamTE/auction_mcp

Service:
https://auction-mcpa.vercel.app

Health:
https://auction-mcpa.vercel.app/api/health

MCP:
https://auction-mcpa.vercel.app/api/mcp

OAuth Authorization:
https://auction-mcpa.vercel.app/oauth/authorize

OAuth Token:
https://auction-mcpa.vercel.app/oauth/token

OAuth Authorization Server Metadata:
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server

OAuth Protected Resource Metadata:
https://auction-mcpa.vercel.app/.well-known/oauth-protected-resource
```

---

## 3. 반드시 유지해야 하는 보안 정책

다음 규칙은 작업 중 절대 완화하지 않는다.

```text
- GitHub 저장소는 Private 유지
- MCP_AUTH_TOKEN을 GitHub에 commit하지 않음
- 실제 secret을 README/docs/source에 기록하지 않음
- secret을 사용자에게 채팅으로 보내라고 요구하지 않음
- 가능하면 사용자가 Vercel Environment Variables 화면에서 직접 입력하게 함
- 로그에 secret을 출력하지 않음
- URL query parameter에 secret을 넣지 않음
- 이전에 노출된 token이 있다면 재사용하지 않음
```

비밀값이 필요한데 에이전트가 환경변수를 직접 설정할 수 없다면 다음처럼 안내하고 멈춘다.

```text
Vercel → Project → Settings → Environment Variables에서
MCP_AUTH_TOKEN에 새 랜덤 값을 입력해주세요.
입력 완료 후 "설정했어"라고 알려주세요.
실제 값은 채팅에 보내지 마세요.
```

권장 secret 생성 예:

```bash
openssl rand -hex 32
```

---

## 4. 읽기 전용 및 사이트 보호 정책

이 MCP는 경매 조회만 수행한다.

절대 추가하거나 실행하지 말 것:

```text
- 입찰
- 입찰서 제출
- 결제
- 보증금 납부
- 자동 신청/제출
- CAPTCHA 우회
- 접근제어/WAF 우회
- 차단된 IP에 대한 공격적인 자동 재시도
- 과도한 병렬 크롤링
```

법원 사이트가 `BLOCKED`, `ipcheck=false`, WAF 차단 또는 유사한 신호를 반환하면 자동 반복 요청을 멈춘다.

---

## 5. 사용자가 직접 해야 하는 단계

다음은 에이전트가 가능한 경우를 제외하면 사용자 상호작용이 필요할 수 있다.

```text
1. GitHub/Vercel 계정 로그인
2. GitHub ↔ Vercel Integration 승인
3. Private repository 접근 권한 승인
4. MCP_AUTH_TOKEN 같은 비밀값 입력
5. ChatGPT Developer Mode 활성화
6. ChatGPT Custom MCP App 생성 UI 입력
7. OAuth 사용자 승인
8. 플랫폼에서 요구하는 보안 확인/권한 승인
```

이 외의 작업은 가능한 한 에이전트가 직접 수행한다.

사용자에게 불필요하게 수동 명령을 시키지 않는다.

---

## 6. 설치 자동화 기본 순서

설치 요청을 받으면 아래 순서로 진행한다.

### Step 1 — 저장소 확인

확인 항목:

```text
Repository: XamTE/auction_mcp
Visibility: private
Default branch: main
```

필수 파일 존재 여부 확인:

```text
package.json
next.config.ts
tsconfig.json
vercel.json
app/api/health/route.ts
app/api/mcp/route.ts
app/oauth/authorize/route.ts
app/oauth/token/route.ts
src/oauth.ts
src/provider.ts
src/server.ts
```

누락된 파일이 있다면 원인을 확인하고 수정한다.

---

### Step 2 — 의존성 설치 및 빌드 검증

가능한 환경에서는 직접 실행한다.

```bash
npm install
npm run typecheck
npx next build
```

프로젝트 script가 이미 적절히 정의되어 있다면 해당 script를 우선 사용한다.

성공 기준:

```text
npm install 성공
TypeScript 오류 없음
Next.js production build 성공
```

빌드 오류가 나면 로그를 읽고 실제 원인을 수정한다. 단순히 사용자에게 로그를 전달하고 끝내지 않는다.

---

### Step 3 — Vercel 설정 확인

GitHub Import 기반 배포를 우선한다.

권장:

```text
Vercel
→ Add New Project
→ Import XamTE/auction_mcp
→ Framework: Next.js
```

필수 환경변수:

```text
MCP_AUTH_TOKEN
```

환경변수 관리 API/도구가 없다면 사용자에게 해당 값만 직접 입력하도록 요청한다.

---

### Step 4 — 배포 확인

배포가 끝나면 추측하지 말고 실제 endpoint를 검증한다.

#### Health

```text
GET https://auction-mcpa.vercel.app/api/health
```

정상 예:

```json
{"ok":true,"service":"court-auction-mcp"}
```

#### MCP unauthenticated

```text
GET https://auction-mcpa.vercel.app/api/mcp
```

정상 예:

```json
{"error":"Unauthorized"}
```

`Unauthorized`는 정상적인 보안 동작이다.

---

### Step 5 — OAuth Metadata 검증

Authorization Server Metadata:

```text
https://auction-mcpa.vercel.app/.well-known/oauth-authorization-server
```

반드시 확인할 값:

```json
{
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "client_secret_basic"
  ],
  "scopes_supported": ["auction:read", "offline_access"]
}
```

특히 ChatGPT 연결에서는 다음이 반드시 필요하다.

```text
code_challenge_methods_supported contains S256
```

Protected Resource Metadata:

```text
https://auction-mcpa.vercel.app/.well-known/oauth-protected-resource
```

MCP 401 응답의 `WWW-Authenticate` 헤더도 OAuth resource metadata 위치를 광고해야 한다.

---

## 7. ChatGPT Custom MCP 등록값

사용자가 ChatGPT 앱 생성 화면을 열었을 때 다음 값을 안내한다.

```text
App Name:
법원 경매 mcp

MCP URL:
https://auction-mcpa.vercel.app/api/mcp

Authentication:
OAuth

Registration Method:
사용자 정의 OAuth 클라이언트

OAuth Client ID:
chatgpt-court-auction

OAuth Client Secret:
Vercel의 MCP_AUTH_TOKEN 실제 값

Token Endpoint Authentication Method:
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

Authorization Server Base:
https://auction-mcpa.vercel.app

Resource:
https://auction-mcpa.vercel.app/api/mcp

OIDC:
OFF
```

DCR/CIMD 경고는 사용자 정의 OAuth 클라이언트 방식에서는 반드시 오류가 아니다.

---

## 8. MCP 도구 성공 기준

최종적으로 아래 4개 도구가 보여야 한다.

```text
search_auctions
get_auction_case
get_auction_schedule
get_auction_result
```

OAuth 연결 성공만으로 설치 완료라고 판단하지 않는다.

반드시 다음 단계까지 검증한다.

```text
OAuth 연결
→ tools/list 성공
→ 4개 tool 확인
→ 실제 search_auctions 1회
→ 법원 경매 데이터 반환 확인
```

---

## 9. 실제 데이터 테스트

안전한 최소 테스트 예:

```text
서울 지역 법원경매 물건 5개 찾아줘
```

또는 MCP tool 직접 호출 시 결과 개수를 작게 제한한다.

권장:

```text
pageSize: 10 이하
maxResults: 5~10
```

대량 요청으로 테스트하지 않는다.

---

## 10. 현재까지 확인된 중요한 동작 특성

이 프로젝트에서는 과거 다음이 실제로 확인되었다.

```text
Vercel → 법원 사이트 warmup HTTP 200
Set-Cookie 수신 성공
실제 property search 10건 반환 성공
```

반면 GitHub Actions 환경에서는 실제 법원 요청이 `NETWORK_ERROR`를 낸 적이 있다.

따라서 다음 원칙을 따른다.

```text
GitHub Actions에서 upstream network error가 났다고 해서
운영 Vercel에서도 법원 사이트가 차단됐다고 단정하지 않는다.

운영 Vercel 환경에서 별도로 검증한다.
```

---

## 11. court-auction-notice-search 관련 주의

핵심 데이터 조회는 다음 패키지를 사용한다.

```text
court-auction-notice-search
```

패키지는 HTTP transport와 선택적 browser/playwright fallback을 포함할 수 있다.

Next/Vercel 빌드 시 optional runtime을 강제로 번들링하려고 하면 오류가 생길 수 있다.

현재 `next.config.ts`의 external package 설정을 함부로 제거하지 않는다.

예시:

```ts
serverExternalPackages: [
  'court-auction-notice-search',
  'k-skill-browser-runtime',
  'playwright-core',
  'rebrowser-playwright',
]
```

수정이 필요하면 반드시 `next build`로 재검증한다.

---

## 12. .well-known 경로 주의

OAuth discovery는 다음 표준 경로를 사용한다.

```text
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource
```

Next.js/Vercel에서 안정적으로 제공하기 위해 일반 API route로 rewrite하는 구성이 사용될 수 있다.

이 rewrite를 제거하기 전에 실제 배포 endpoint에서 metadata가 정상 노출되는지 검증한다.

---

## 13. 오류별 대응 규칙

### `Deployment has failed`

다음 순서:

```text
1. Vercel build log 확인
2. npm install 재현
3. typecheck
4. next build
5. 오류 파일 수정
6. 다시 배포
```

"Vercel 문제"라고 추측해서 끝내지 않는다.

---

### `/api/health` 404 또는 500

```text
Next.js route structure
배포 branch
Vercel Root Directory
최신 deployment 상태
```

을 확인한다.

---

### `/api/mcp`가 인증 없이 200

보안 문제다.

즉시 인증 로직을 확인한다.

정상은 `401 Unauthorized`다.

---

### OAuth PKCE 오류

예:

```text
OAuth authorization server metadata must advertise PKCE support...
```

다음을 실제 URL에서 확인한다.

```text
/.well-known/oauth-authorization-server
```

필수:

```json
"code_challenge_methods_supported": ["S256"]
```

코드에만 존재하는 것으로 충분하지 않다. 실제 Production URL 응답을 확인한다.

---

### OAuth는 연결됐는데 Action이 0개

순서:

```text
1. ChatGPT 앱에서 새로 고침
2. MCP endpoint 확인
3. OAuth token 정상 발급 확인
4. tools/list 확인
5. MCP handler 응답/로그 확인
```

앱 정보에 `인증 지원됨: OAuth`, `사용한 인증: OAuth`가 보여도 tools/list가 실패하면 설치 완료가 아니다.

---

### 법원 조회 `NETWORK_ERROR`

먼저 어느 환경에서 발생했는지 구분한다.

```text
Local
GitHub Actions
Vercel Production
```

Vercel에서 warmup과 실제 검색을 각각 최소 1회만 진단한다.

자동 반복 호출하지 않는다.

---

### `BLOCKED` / `ipcheck=false`

즉시 자동 retry를 중단한다.

차단 우회 방법을 구현하지 않는다.

---

## 14. 작업 방식

에이전트는 다음 방식으로 행동한다.

### 해야 하는 것

```text
- 실제 repository/file 읽기
- 현재 상태 확인
- 필요한 코드 수정
- 테스트 실행
- build 실행
- deployment 상태 확인
- endpoint 실제 호출
- 로그 기반 디버깅
- 성공/실패를 명확히 구분
```

### 하지 말아야 하는 것

```text
- 검증하지 않은 상태를 "완료"라고 말하기
- 사용자가 할 수 있는 일을 전부 수동으로 떠넘기기
- secret을 채팅에 붙여달라고 요구하기
- 인증을 제거해 문제를 우회하기
- 저장소를 Public으로 바꾸기
- 법원 사이트 접근 제한을 우회하기
- 필요 이상으로 반복 호출하기
```

---

## 15. 사용자에게 질문해야 하는 경우

질문은 실제로 작업을 진행할 수 없는 경우에만 한다.

좋은 예:

```text
Vercel 환경변수 편집 권한이 현재 도구에 없습니다.
MCP_AUTH_TOKEN을 Production에 추가해주세요.
실제 값은 보내지 말고 완료 여부만 알려주세요.
```

나쁜 예:

```text
Vercel에 로그인했나요?
GitHub가 연결됐나요?
어떤 프레임워크인가요?
```

이런 정보는 도구로 확인할 수 있다면 먼저 직접 확인한다.

---

## 16. 설치 완료 판정

다음 체크리스트가 모두 충족되어야 완료로 판정한다.

```text
[ ] GitHub repository private
[ ] npm install 성공
[ ] typecheck 성공
[ ] next build 성공
[ ] Vercel production deployment Ready
[ ] /api/health = 200
[ ] /api/mcp unauthenticated = 401
[ ] OAuth authorization metadata 정상
[ ] PKCE S256 광고 정상
[ ] OAuth protected resource metadata 정상
[ ] ChatGPT OAuth 연결 성공
[ ] tools/list 성공
[ ] 4개 MCP tool 표시
[ ] search_auctions 최소 실제 호출 성공
[ ] 실제 법원 경매 데이터 반환 확인
```

완료되지 않은 항목이 있다면 "설치 완료"라고 표현하지 않는다.

---

## 17. 사용자가 설치 후 사용하는 예시

```text
서울 지역 법원경매 물건 5개 찾아줘
```

```text
서울 아파트 경매 중 최저매각가격 5억 이하 물건 찾아줘
```

```text
경기도 성남시에서 2회 이상 유찰된 아파트 경매 찾아줘
```

```text
서울중앙지방법원 2025타경12345 사건 상세 조회해줘
```

```text
이번 달 서울중앙지방법원 부동산 경매 일정 알려줘
```

```text
2025타경12345 사건 매각 결과 알려줘
```

---

## 18. 최종 결과 보고 형식

작업이 끝나면 사용자에게 최소 다음을 알려준다.

```text
배포 상태: 성공/실패
Health: 성공/실패
OAuth: 성공/실패
MCP tools: 4개 확인 여부
실제 경매 검색: 성공/실패
MCP URL: https://auction-mcpa.vercel.app/api/mcp
사용자가 추가로 해야 할 일: 있으면 정확히 명시
```

secret 값은 결과 보고에 포함하지 않는다.

---

## 19. 문서 유지보수

설치 과정에서 구조가 변경되면 가능하면 다음 두 문서를 함께 갱신한다.

```text
docs/DEPLOYMENT_INSTALL_GUIDE.md
docs/AGENTS.md
```

특히 다음이 바뀌면 반드시 문서도 수정한다.

```text
MCP URL
OAuth endpoints
OAuth Client ID
scope
tool names
Vercel deployment 구조
필수 environment variable
설치 절차
```

---

## 20. 핵심 원칙 요약

```text
Read docs first.
Inspect reality before assuming.
Automate what can be automated.
Ask the user only when truly required.
Never expose secrets.
Keep the repository private.
Keep the MCP read-only.
Do not bypass court-site controls.
Verify build, OAuth, tools/list, and a real search before declaring success.
```
