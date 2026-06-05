// 공유 링크 랜딩 로직.
// 페이지가 window.BUNGL_TYPE ('bung' | 'club') 을 미리 설정하고,
// ?id=<id> 로 대상 id 를 받는다.
// 설치 시 bungs://<type>/<id> 스킴으로 앱을 열고, 미설치면 OS 별 스토어로 보낸다.
(function () {
  var PLAY = 'https://play.google.com/store/apps/details?id=com.taesori.bungs';
  var APPSTORE = 'https://apps.apple.com/app/id6764893272';

  var type = window.BUNGL_TYPE;
  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  var valid = (type === 'bung' || type === 'club') && id && /^[A-Za-z0-9-]+$/.test(id);

  var ua = navigator.userAgent || '';
  var isAndroid = /android/i.test(ua);
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);

  var playEl = document.getElementById('play');
  var appEl = document.getElementById('appstore');
  if (playEl) playEl.href = PLAY;
  if (appEl) appEl.href = APPSTORE;
  var stores = document.getElementById('stores');
  if (stores) stores.style.display = 'flex';

  var statusEl = document.getElementById('status');
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }

  if (!valid) { setStatus('아래에서 Bungl 앱을 설치할 수 있어요.'); return; }
  if (!isAndroid && !isIOS) {
    setStatus('모바일에서 열면 Bungl 앱으로 바로 이동해요.');
    return;
  }

  var scheme = 'bungs://' + type + '/' + id;
  var store = isIOS ? APPSTORE : PLAY;
  var start = Date.now();
  var redirected = false;

  function goStore() {
    if (redirected || document.hidden) return;
    if (Date.now() - start < 1400) return;
    redirected = true;
    window.location = store;
  }

  window.location = scheme;
  setTimeout(goStore, 1500);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) redirected = true;
  });
})();
