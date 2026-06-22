// Cloudflare Worker — bungl.org 공유 링크 동적 OG 미리보기.
//
// 왜:
//   bungl.org 는 정적 GitHub Pages 라 /c/, /b/ 가 모든 링크에 같은 OG 메타태그만
//   내려준다. 카카오톡·iMessage 등 크롤러는 JS 를 실행하지 않고 HTML 의 OG 태그만
//   읽으므로, "클럽마다 다른 썸네일/타이틀" 미리보기를 정적 호스팅으로는 못 만든다.
//   이 Worker 가 GitHub Pages 앞단에서 /c/* , /b/* 요청을 가로채 ?id 별로 OG 를
//   동적으로 그려준다.
//
// 동작:
//   GET https://bungl.org/c/?id=<clubId>   (클럽)
//   GET https://bungl.org/b/?id=<bungId>   (벙)
//   - Supabase RPC get_share_meta 로 이름/슬로건/이미지 조회.
//   - 크롤러: OG 태그를 읽어 미리보기 카드 생성(JS 미실행).
//   - 사람:   인라인 JS 가 bungs://<type>/<id> 스킴으로 앱을 열고, 미설치면
//             OS 별 스토어로 보냄 (정적 랜딩 share.js 와 동일 흐름).
//
// 라우트는 /c/* , /b/* 에만 걸려 있어 og.png·share.js·약관 등 다른 정적 자산은
// 그대로 GitHub Pages 가 서빙한다(원본 fetch 안 하므로 루프 없음).
//
// 환경변수(wrangler.toml [vars]):
//   SUPABASE_URL — prod 프로젝트 URL
//   SUPABASE_KEY — prod publishable(anon) 키 (클라이언트 노출 안전, RLS 가 보안 책임)

const DEFAULT_OG = 'https://bungl.org/og.png?v=4';
const PLAY = 'https://play.google.com/store/apps/details?id=com.taesori.bungs';
const APPSTORE = 'https://apps.apple.com/app/id6764893272';
const SITE_NAME = 'Bungl';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const type = path.startsWith('/c/')
      ? 'club'
      : path.startsWith('/b/')
      ? 'bung'
      : null;
    if (!type) return fetch(request); // 라우트 밖 — 안전 패스스루

    const id = url.searchParams.get('id') || '';
    let meta = null;
    if (/^[0-9a-fA-F-]{36}$/.test(id)) {
      meta = await loadMeta(env, type, id);
    }

    return new Response(renderHtml(meta, type, id), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  },
};

async function loadMeta(env, type, id) {
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_share_meta`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_KEY,
        authorization: `Bearer ${env.SUPABASE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_type: type, p_id: id }),
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch (_e) {
    return null;
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(meta, type, id) {
  const title = meta?.title ||
    (type === 'club' ? 'Bungl 클럽에 초대받았어요' : 'Bungl 벙에 초대받았어요');
  const description = meta?.description ||
    '관심사로 모이는 소셜 밋업 — 링크를 열어 둘러보세요.';
  const image = meta?.image || DEFAULT_OG;
  const scheme = id ? `bungs://${type}/${id}` : '';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <style>
    :root{--fg:#1f2330;--muted:#6b7280;--accent:#f5821f;}
    *{box-sizing:border-box;}
    body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;text-align:center;font-family:-apple-system,BlinkMacSystemFont,
      "Apple SD Gothic Neo","Malgun Gothic","Segoe UI",Roboto,sans-serif;color:var(--fg);background:#fff;padding:24px;}
    img.logo{width:120px;height:120px;border-radius:24px;object-fit:cover;}
    .badge{display:inline-block;margin-top:18px;padding:3px 11px;border-radius:999px;
      background:rgba(245,130,31,.12);color:var(--accent);font-size:12px;font-weight:700;}
    h1{font-size:21px;margin:10px 0 6px;line-height:1.35;max-width:340px;}
    p.desc{color:var(--fg);font-size:15px;margin:0 0 20px;max-width:340px;line-height:1.5;opacity:.85;}
    p.status{color:var(--muted);font-size:13px;margin:0 0 18px;}
    .stores{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;}
    .store{display:inline-block;padding:12px 18px;border-radius:12px;background:var(--accent);
      color:#fff;text-decoration:none;font-weight:700;font-size:14px;}
    .store.alt{background:#111;}
    .hint{color:var(--muted);font-size:12.5px;margin-top:22px;max-width:320px;line-height:1.6;}
  </style>
</head>
<body>
  <img class="logo" src="${esc(image)}" alt="${SITE_NAME}" onerror="this.onerror=null;this.src='${DEFAULT_OG}'" />
  <span class="badge">${type === 'club' ? '클럽' : '벙'}</span>
  <h1>${esc(title)}</h1>
  ${description ? `<p class="desc">${esc(description)}</p>` : ''}
  <p class="status" id="status">앱을 여는 중이에요…</p>
  <div class="stores" id="stores" style="display:none">
    <a class="store" id="play" href="#">Google Play</a>
    <a class="store alt" id="appstore" href="#">App Store</a>
  </div>
  <p class="hint">앱이 설치돼 있으면 자동으로 열려요. 열리지 않으면 위 버튼으로 설치한 뒤 링크를 다시 눌러주세요.</p>
  <script>
    (function () {
      var PLAY = ${JSON.stringify(PLAY)};
      var APPSTORE = ${JSON.stringify(APPSTORE)};
      var scheme = ${JSON.stringify(scheme)};
      var ua = navigator.userAgent || '';
      var isAndroid = /android/i.test(ua);
      var isIOS = /iphone|ipad|ipod/i.test(ua) ||
        (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
      document.getElementById('play').href = PLAY;
      document.getElementById('appstore').href = APPSTORE;
      document.getElementById('stores').style.display = 'flex';
      var statusEl = document.getElementById('status');
      function setStatus(t){ if (statusEl) statusEl.textContent = t; }
      if (!scheme) { setStatus('아래에서 Bungl 앱을 설치할 수 있어요.'); return; }
      if (!isAndroid && !isIOS) { setStatus('모바일에서 열면 Bungl 앱으로 바로 이동해요.'); return; }
      var store = isIOS ? APPSTORE : PLAY;
      var start = Date.now();
      var redirected = false;
      function goStore(){
        if (redirected || document.hidden) return;
        if (Date.now() - start < 1400) return;
        redirected = true;
        window.location = store;
      }
      window.location = scheme;
      setTimeout(goStore, 1500);
      document.addEventListener('visibilitychange', function(){
        if (document.hidden) redirected = true;
      });
    })();
  </script>
</body>
</html>`;
}
