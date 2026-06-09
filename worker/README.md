# bungl.org 공유 링크 동적 OG (Cloudflare Worker)

`bungl.org/c/?id=…`, `bungl.org/b/?id=…` 공유 링크의 **미리보기 카드(썸네일·타이틀)**
를 클럽/벙별로 동적으로 그려주는 Cloudflare Worker.

## 왜 Worker 인가

bungl.org 는 정적 GitHub Pages 라 `/c/`, `/b/` 가 **모든 링크에 같은 OG 메타태그**만
내려준다. 카카오톡·iMessage 등은 링크를 열 때 HTML 의 OG 태그만 읽고(JS 미실행)
미리보기 카드를 만들기 때문에, 정적 호스팅으로는 "클럽마다 다른 이미지/제목"을
못 띄운다.

- Supabase Edge Function 은 `*.supabase.co` 에서 HTML 을 `text/plain` + CSP sandbox 로
  강제 변환해(보안 정책) 미리보기/렌더링이 깨져서 못 쓴다.
- Cloudflare Worker 는 GitHub Pages **앞단**에서 `/c/* /b/*` 만 가로채 정상
  `text/html` 로 동적 OG 를 내려준다. **bungl.org URL·기존 앱열기 흐름 그대로** 유지.

`get_share_meta(p_type, p_id)` RPC(앱 레포 `supabase/migrations/20260609140000_share_meta_rpc.sql`)
가 이름·슬로건·로고를 돌려준다. anon 키로 호출.

## 동작

```
/c/?id=<clubId>  → og:title "클럽명 : 슬로건", og:image 클럽 로고
/b/?id=<bungId>  → og:title "벙 제목"
```
- 크롤러: OG 태그 읽어 카드 생성.
- 사람: 인라인 JS 가 `bungs://<type>/<id>` 로 앱 열기, 미설치 시 스토어.
- `id` 없거나 조회 실패 → 일반 Bungl OG 로 폴백.

## 최초 1회 셋업

### 1. apex A 레코드를 Proxied 로 (회색 → 주황)
bungl.org 는 **이미 Cloudflare 네임서버**(`*.ns.cloudflare.com`)를 쓰고 있어
네임서버/레지스트라 변경은 필요 없다. 단, GitHub Pages apex A 레코드 4개가 현재
**DNS only(회색 구름)** 라 트래픽이 Cloudflare 를 안 거친다 → Worker 라우트가
발동하지 않는다. 다음만 하면 된다:

1. Cloudflare 대시보드 → `bungl.org` → **DNS → Records**.
2. apex A 레코드 4개를 각각 **Proxied(주황 구름)** 로 토글:
   ```
   A  bungl.org  185.199.108.153   DNS only → Proxied
   A  bungl.org  185.199.109.153   DNS only → Proxied
   A  bungl.org  185.199.110.153   DNS only → Proxied
   A  bungl.org  185.199.111.153   DNS only → Proxied
   ```
   (회색=프록시 안 함=Worker 미발동, 주황=엣지 통과=Worker 발동.)
3. **SSL/TLS → Overview → Full** 로 설정(Flexible 은 리다이렉트 루프 유발, 금지).
   GitHub Pages 는 유효 인증서가 있어 Full / Full(strict) 둘 다 OK.

> GitHub Pages 설정의 커스텀 도메인(`bungl.org`)·Enforce HTTPS 는 그대로 둔다.
> 인증서는 이미 발급돼 있어 프록시 후에도 동작한다.
>
> 확인: `dig +short A bungl.org` 가 Cloudflare IP(104.x / 172.67.x)로 바뀌고
> `curl -sI https://bungl.org/` 응답에 `cf-ray` 헤더가 생기면 프록시 적용된 것.

### 2. Worker 배포
```bash
cd worker
npm i -g wrangler        # 최초 1회
wrangler login           # 브라우저로 Cloudflare 인증
wrangler deploy          # routes(/c/*, /b/*) 까지 함께 등록됨
```
`wrangler.toml` 의 `SUPABASE_URL`/`SUPABASE_KEY` 는 prod 값이 박혀 있다. 키를
숨기고 싶으면 `[vars]` 에서 빼고 `wrangler secret put SUPABASE_KEY` 로 옮긴다.

### 3. 검증
```bash
# OG 태그가 클럽별로 나오는지 (크롤러 흉내)
curl -s "https://bungl.org/c/?id=<클럽UUID>" | grep -i 'og:title\|og:image'
```
- 카카오톡: 나에게 `https://bungl.org/c/?id=<클럽UUID>` 전송 → 카드에 클럽
  이미지 + `클럽명 : 슬로건` 확인. (카카오는 OG 를 캐시하므로 변경 후 반영이
  느릴 수 있음. 카카오 OG 디버거로 캐시 무효화 가능.)

## 변경/롤백
- 코드 수정 후 `wrangler deploy` 만 다시.
- 끄려면 Cloudflare 대시보드에서 Worker 라우트 제거 → 즉시 기존 정적 `/c/`,`/b/`
  페이지로 폴백(고정 OG).

## 메모
- Worker 는 `/c/* /b/*` 만 처리한다. 라우트 패턴상 `/child-safety.html` 등은
  매칭되지 않는다(`/c/` 슬래시 포함).
- OG 크롤러(facebookexternalhit, kakaotalk-scrap 등)가 Cloudflare 봇 차단에
  걸리면 미리보기가 안 뜬다. 그럴 땐 WAF 에서 해당 UA 를 skip 규칙으로 허용.
