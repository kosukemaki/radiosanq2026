const socials = `
  <a href="https://www.youtube.com/channel/UCwECsMjH7U9VOzlFt3tn-zQ" target="_blank" rel="noopener noreferrer">YouTube <span>↗</span></a>
  <a href="https://twitter.com/RADIOSANQ" target="_blank" rel="noopener noreferrer">X <span>↗</span></a>
  <a href="https://www.instagram.com/radiosanq/" target="_blank" rel="noopener noreferrer">Instagram <span>↗</span></a>`;

const header = document.querySelector('#site-header');
if (header) {
  header.innerHTML = `
    <div class="topline"><div class="wrap topline-inner"><span>瀬戸・尾張旭・長久手のコミュニティFM</span><div class="top-social">${socials}</div></div></div>
    <header class="site-header"><div class="wrap nav-wrap">
      <a class="brand" href="index.html" aria-label="ラジオサンキュー ホーム"><span class="brand-mark"><i></i><i></i><i></i></span><span class="brand-name">RADIO SANQ<small>ラジオサンキュー <b>FM84.5</b></small></span></a>
      <button class="menu-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="メニューを開く"><span></span><span></span></button>
      <nav class="primary-nav" id="primary-nav" aria-label="メインメニュー">
        <a href="personalities.html">パーソナリティ</a><a href="archive.html">アーカイブ</a><a href="about.html">局について</a><a href="business.html">広告・地域事業者向け支援</a>
        <a class="nav-message" href="message.html">メッセージ <span>→</span></a>
        <a class="nav-listen" href="https://www.jcbasimul.com/radiosanq" target="_blank" rel="noopener noreferrer"><span class="nav-play">▶</span> 聴く</a>
      </nav>
    </div>
    <nav class="action-bar" aria-label="聴く・番組表・メッセージ"><div class="wrap action-bar-inner">
      <a class="action-listen" href="https://www.jcbasimul.com/radiosanq" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> ラジオを聴く <span aria-hidden="true">↗</span></a>
      <a data-schedule-link aria-disabled="true" role="link" tabindex="0">番組表PDF（準備中） <span aria-hidden="true">↓</span></a>
      <a href="message.html">メッセージを送る <span aria-hidden="true">→</span></a>
    </div></nav></header>`;
  const toggle = header.querySelector('.menu-toggle');
  const nav = header.querySelector('.primary-nav');
  const setMenuOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(false);
      toggle.focus();
    }
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) setMenuOpen(false);
  });
  // Reset the mobile menu when switching to the desktop layout.
  matchMedia('(min-width: 1081px)').addEventListener('change', event => {
    if (event.matches) setMenuOpen(false);
  });
}

const footer = document.querySelector('#site-footer');
if (footer) {
  footer.innerHTML = `
    <footer class="site-footer"><div class="wrap footer-main">
      <div class="footer-brand"><a class="brand brand-inverse" href="index.html"><span class="brand-mark"><i></i><i></i><i></i></span><span class="brand-name">RADIO SANQ<small>ラジオサンキュー <b>FM84.5</b></small></span></a><p>まちの声を、まちの力に。<br>瀬戸・尾張旭・長久手のコミュニティFM。</p></div>
      <div class="footer-nav"><span>MENU</span><a href="personalities.html">パーソナリティ</a><a href="archive.html">アーカイブ</a><a href="message.html">メッセージ</a><a href="business.html">広告・情報発信のご相談</a><a href="about.html">局について</a></div>
      <div class="footer-contact"><span>CONTACT</span><a href="tel:0561853555">0561-85-3555</a><a href="mailto:info@845.fm">info@845.fm</a><p>株式会社 尾張東部放送</p><div class="footer-social">${socials}</div></div>
    </div><div class="wrap footer-bottom"><span>© <span id="year"></span> RADIO SANQ / Owari Tobu Broadcasting Co., Ltd.</span><span>FM 84.5 MHz</span></div></footer>`;
  footer.querySelector('#year').textContent = new Date().getFullYear();
}

const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.primary-nav a, .footer-nav a, .action-bar a').forEach(link => {
  if (link.getAttribute('href') === currentPage) link.setAttribute('aria-current', 'page');
});

// Enable timetable buttons only after the approved distribution PDF is added to this path.
const schedulePath = 'assets/program-guide.pdf';
const scheduleLinks = document.querySelectorAll('[data-schedule-link], [data-schedule-card]');
if (scheduleLinks.length) {
  // Static hosts may return an HTML fallback with status 200 for a missing file.
  // Require a PDF signature rather than enabling a broken download from status alone.
  fetch(schedulePath, { cache: 'no-store' }).then(async response => {
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    const signature = [];
    try {
      while (signature.length < 5) {
        const { value, done } = await reader.read();
        if (done) break;
        signature.push(...value.subarray(0, 5 - signature.length));
      }
    } finally {
      await reader.cancel();
    }
    if (String.fromCharCode(...signature) !== '%PDF-') return;
    scheduleLinks.forEach(link => {
      link.href = schedulePath;
      link.setAttribute('download', 'RADIO-SANQ-program-guide.pdf');
      link.removeAttribute('aria-disabled');
      link.classList.remove('is-disabled');
      if (link.dataset.scheduleCard !== undefined) {
        const note = link.querySelector('[data-schedule-card-note]');
        if (note) note.textContent = '週間番組表をダウンロード';
      }
      if (link.dataset.scheduleLink !== undefined) link.innerHTML = '番組表PDF <span aria-hidden="true">↓</span>';
      link.setAttribute('aria-label', '週間番組表PDFをダウンロード');
    });
    document.querySelectorAll('[data-schedule-note]').forEach(note => note.remove());
    document.querySelectorAll('[data-schedule-summary]').forEach(note => {
      note.textContent = '正式な週間番組表PDFを公開しています。「番組表PDF」からダウンロードできます。';
    });
  }).catch(() => {});
}

const messageForm = document.querySelector('#message-form');
if (messageForm) messageForm.hidden = false;
messageForm?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(messageForm);
  const message = String(data.get('message') || '').trim();
  const status = document.querySelector('#form-status');
  if (!message) {
    status.textContent = 'メッセージを入力してください。';
    messageForm.elements.message.focus();
    return;
  }
  const name = String(data.get('name') || '').trim();
  const program = String(data.get('program') || '').trim();
  const lines = [
    `お名前・ラジオネーム：${name || '未記入'}`,
    `番組名：${program || '未記入'}`,
    '', message
  ];
  const subject = program ? `番組へのメッセージ（${program}）` : 'ラジオサンキューへのメッセージ';
  status.textContent = 'サイトからは送信されていません。開いたメールアプリで内容を確認し、送信してください。アプリが開かない場合は、入力内容をコピーして info@845.fm へ直接お送りください。';
  window.location.href = `mailto:info@845.fm?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
});
