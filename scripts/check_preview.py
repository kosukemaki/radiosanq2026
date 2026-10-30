import json, re
from pathlib import Path
import argparse, shutil
from urllib.parse import urlsplit, unquote, parse_qs
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description='ローカルプレビューの回帰検証（正式PDF未配置の初稿用）')
parser.add_argument('--base-url', default='http://127.0.0.1:8000/')
parser.add_argument('--output', default='/tmp/radiosanq-preview-review')
parser.add_argument('--chromium', default=shutil.which('chromium'))
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1] / 'dist'
OUT = Path(args.output)
OUT.mkdir(parents=True, exist_ok=True)
PAGES=sorted(p.name for p in ROOT.glob('*.html'))
BASE=args.base_url.rstrip('/') + '/'
checks=[]
def record(name):
 checks.append(name)
 print('PASS', name, flush=True)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
 context=browser.new_context()
 page=context.new_page()
 errors=[]
 page.on('pageerror', lambda e:errors.append(str(e)))
 for width in (320,390,768,1024,1440):
  page.set_viewport_size({'width':width,'height':900})
  for name in PAGES:
   response=page.goto(BASE+name)
   assert response.status==200
   page.wait_for_function("document.querySelector('.action-bar') !== null")
   page.wait_for_timeout(120)
   assert page.locator('h1').count()==1
   assert page.locator('.action-bar a').count()==3
   assert page.locator('.action-bar a.action-listen').get_attribute('href')=='https://www.jcbasimul.com/radiosanq'
   for social in ['https://www.youtube.com/channel/UCwECsMjH7U9VOzlFt3tn-zQ','https://twitter.com/RADIOSANQ','https://www.instagram.com/radiosanq/']:
    assert page.locator('.footer-social a[href="'+social+'"]').count()==1
   for a in page.locator('[data-schedule-link], [data-schedule-card]').all():
    assert a.get_attribute('aria-disabled')=='true'
    assert a.get_attribute('href') is None
    assert '準備中' in a.inner_text()
   overflow=page.evaluate('({viewport:innerWidth,width:document.documentElement.scrollWidth})')
   assert overflow['width']<=width, (name,width,overflow)
   if width in (390,1440):
    page.screenshot(path=str(OUT/f'{name[:-5]}-{width}.png'),full_page=True)
   if width<=1080:
    toggle=page.locator('.menu-toggle')
    toggle.click()
    assert toggle.get_attribute('aria-expanded')=='true'
    assert page.locator('.primary-nav').is_visible()
    assert page.locator('.primary-nav').evaluate('(el)=>el.getBoundingClientRect().right')<=width
    page.keyboard.press('Escape')
    assert toggle.get_attribute('aria-expanded')=='false'
    assert not page.locator('.primary-nav').is_visible()
    assert toggle.evaluate('(el)=>el === document.activeElement')
   # Verify all actual internal link targets, assets and anchor IDs.
   links=page.locator('a[href],link[href],script[src]').evaluate_all("els=>els.map(el=>el.getAttribute('href')||el.getAttribute('src'))")
   for target in links:
    parsed=urlsplit(target)
    if parsed.scheme or parsed.netloc: continue
    if parsed.path:
     dest=(ROOT/unquote(parsed.path)).resolve()
     assert dest.is_file(), (name,target)
     assert urlopen(BASE+parsed.path).status==200
    if parsed.fragment and not parsed.path:
     assert page.locator('[id="'+parsed.fragment+'"]').count()==1,(name,target)
   record(f'{name}: {width}px, layout/menu/PDF state/internal links/social destinations')
 # PDF detection: do not create or distribute an invented schedule.
 for payload,ctype,enabled,label in [
  ('<html>fallback</html>','text/html',False,'HTML fallback'),
  ('not a pdf','application/pdf',False,'invalid PDF'),
  ('%PDF-1.7\nfixture for response detection only','application/pdf',True,'PDF response')]:
  page.route('**/assets/program-guide.pdf',lambda route,request,body=payload,typ=ctype:route.fulfill(status=200,content_type=typ,body=body))
  for name in PAGES:
   page.goto(BASE+name)
   if enabled:
    page.wait_for_function("[...document.querySelectorAll('[data-schedule-link], [data-schedule-card]')].every(a => a.hasAttribute('download') && a.getAttribute('href') === 'assets/program-guide.pdf')")
   else:
    page.wait_for_timeout(120)
    assert page.locator('[data-schedule-link][href], [data-schedule-card][href]').count()==0
  record(f'PDF detection on all pages: {label}')
  page.unroute('**/assets/program-guide.pdf')
 # Form validation and mailto destination/body, without sending any message.
 page.goto(BASE+'message.html')
 assert page.locator('#message-form input').count()==2
 assert not page.locator('textarea').evaluate('(el)=>el.checkValidity()')
 page.locator('textarea').fill('   ')
 page.locator('button[type=submit]').click()
 assert '入力してください' in page.locator('#form-status').inner_text()
 page.locator('[name=name]').fill(' テスト & SANQ ')
 page.locator('[name=program]').fill(' テスト番組 ')
 page.locator('textarea').fill('地域の話題です。\n曲のリクエスト & 感想 #1')
 client=context.new_cdp_session(page)
 client.send('Page.enable')
 navigation=[]
 client.on('Page.frameRequestedNavigation',lambda event:navigation.append(event.get('url','')))
 status_updates=[]
 page.on('console', lambda msg: status_updates.append(msg.text))
 page.evaluate("new MutationObserver(() => console.debug('STATUS:' + document.querySelector('#form-status').textContent)).observe(document.querySelector('#form-status'), {childList:true})")
 page.locator('button[type=submit]').click()
 page.wait_for_timeout(300)
 mailto=next(u for u in navigation if u.startswith('mailto:'))
 assert mailto.startswith('mailto:info@845.fm?')
 query=parse_qs(urlsplit(mailto).query)
 assert query['subject']==['番組へのメッセージ（テスト番組）']
 assert 'お名前・ラジオネーム：テスト & SANQ' in query['body'][0]
 assert '地域の話題です。\n曲のリクエスト & 感想 #1' in query['body'][0]
 assert any('サイトからは送信されていません' in text for text in status_updates),status_updates
 record('Message: required/whitespace validation and encoded mailto subject/body/destination')
 # Keyboard skip link.
 page.goto(BASE+'index.html')
 page.keyboard.press('Tab')
 assert page.locator('.skip-link').evaluate('(el)=>el === document.activeElement')
 page.keyboard.press('Enter')
 assert page.locator('main').evaluate('(el)=>el === document.activeElement')
 record('Keyboard skip link')
 # JavaScript-disabled visitors have navigation and a direct mail fallback.
 nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':900})
 fallback=nojs.new_page()
 for name in PAGES:
  fallback.goto(BASE+name)
  assert fallback.locator('.no-script-nav').is_visible()
  if name=='message.html':
   assert not fallback.locator('#message-form').is_visible()
   assert fallback.locator('noscript a[href="mailto:info@845.fm"]').is_visible()
 record('No-JavaScript navigation on six pages and safe message fallback')
 assert errors==[],errors
 record('No uncaught browser JavaScript errors')
 browser.close()
(OUT/'results.json').write_text(json.dumps({'passed':checks,'count':len(checks)},ensure_ascii=False,indent=2))
