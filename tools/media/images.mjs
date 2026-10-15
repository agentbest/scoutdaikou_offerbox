// tools/media/images.mjs … 「地方採用ラボ」のアイキャッチ兼OGP画像（1200×630 JPEG）を作る。
//
//   node tools/media/generate.mjs   … 先に実行（tools/media/image-specs.json を書き出す）
//   node tools/media/images.mjs     … 画像を作る（変わったものだけ描き直す）
//
// 出力: media/img/{slug}.jpg      … 記事 2,000枚（記事上部のアイキャッチと og:image を兼ねる）
//       media/img/og/*.jpg        … トップ・グループ・ハブ・検索の og:image
//
// ⚠ 描画は手元の Microsoft Edge をヘッドレスで起動し、DevTools Protocol で撮る（npm 依存なし）。
//    フォントは Windows の游ゴシック。別の環境で作り直すと字形が変わり、全画像が差分になる。
// ⚠ 見た目はコーポレート（www.agent-best.net/media/）のアイキャッチに揃えている：
//    濃色グラデーション・左上にカテゴリ枠・大きなタイトル・下にアクセント線・右上に円。
//    色は地方採用ラボの #1C1C2E 系。アクセント色だけグループごとに変える。
// ⚠ image-hashes.json に「描いた内容のハッシュ」を残し、同じ内容なら描き直さない。
//    テンプレート（TEMPLATE_VERSION）を変えたら数字を上げると全部描き直す。
// ⚠ JPEG（品質88）にしているのは容量のため。グラデーション地は PNG だと1枚約190KB、JPEG で約45KB。

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SPEC_FILE = resolve(HERE, 'image-specs.json');
const HASH_FILE = resolve(HERE, 'image-hashes.json');
const TEMPLATE_VERSION = 2;

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

// グループごとのアクセント色（濃紺の地で読める明るさにしている）
const ACCENT = {
  area: '#5CC8D6',
  industry: '#E3B45C',
  issue: '#EE8F6E',
  dr: '#8CCB8A',
  theme: '#B4A6EE',
  site: '#5CC8D6',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// タイトルは「主題｜副題」の形が多い。主題を大きく、副題を一段小さく出す。
function splitTitle(t) {
  const i = t.indexOf('｜');
  return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i + 1)];
}
function mainSize(s) {
  const n = [...s].length;
  if (n <= 12) return 76;
  if (n <= 18) return 66;
  if (n <= 26) return 58;
  if (n <= 34) return 52;
  return 46;
}

function html(spec) {
  const accent = ACCENT[spec.group] ?? ACCENT.site;
  const [main, sub] = splitTitle(spec.title);
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:"Yu Gothic","YuGothic","Meiryo",sans-serif;font-weight:700;color:#fff;
  background:linear-gradient(160deg,#1C1C2E 0%,#262642 55%,#2F3150 100%);position:relative}
.circle{position:absolute;right:-150px;top:-190px;width:460px;height:460px;border:2px solid ${accent};border-radius:50%;opacity:.85}
.circle2{position:absolute;right:60px;top:110px;width:120px;height:120px;border:2px solid ${accent};border-radius:50%;opacity:.35}
.in{position:absolute;left:80px;right:80px;top:84px;bottom:64px;display:flex;flex-direction:column}
.t{padding-right:150px}
.tags{display:flex;gap:14px;align-items:center}
.tag{display:inline-block;border:2px solid ${accent};color:${accent};font-size:28px;line-height:1;padding:12px 20px;border-radius:6px;font-weight:700}
.grp{color:rgba(255,255,255,.62);font-size:24px;font-weight:500}
.t{margin-top:auto;margin-bottom:auto;word-break:auto-phrase;line-break:strict}
.main{font-size:${spec.size ?? mainSize(main)}px;line-height:1.38;letter-spacing:.02em}
.sub{margin-top:22px;font-size:34px;line-height:1.45;color:rgba(255,255,255,.82);font-weight:500}
.foot{display:flex;align-items:flex-end;justify-content:space-between}
.line{width:240px;height:4px;background:${accent};margin-bottom:12px}
.brand{text-align:right}
.brand b{display:block;font-size:30px;letter-spacing:.06em}
.brand span{display:block;font-size:17px;color:rgba(255,255,255,.6);font-weight:500;margin-top:6px}
</style></head><body>
<div class="circle"></div><div class="circle2"></div>
<div class="in">
  <div class="tags">${spec.tag ? `<span class="tag">${esc(spec.tag)}</span>` : ''}${spec.groupLabel ? `<span class="grp">${esc(spec.groupLabel)}</span>` : ''}</div>
  <div class="t"><div class="main">${esc(main)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
  <div class="foot"><div class="line"></div><div class="brand"><b>地方採用ラボ</b><span>株式会社エージェントベスト</span></div></div>
</div>
</body></html>`;
}

/* ---------- Edge（DevTools Protocol） ---------- */
async function launchEdge() {
  const exe = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('[images] Microsoft Edge が見つかりません（EDGE_PATH で指定できます）');
  const profile = resolve(tmpdir(), `media-img-edge-${process.pid}`);
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((ok, ng) => {
    let buf = '';
    const t = setTimeout(() => ng(new Error('[images] Edge の起動待ちがタイムアウトしました')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, ng) => { ws.onopen = ok; ws.onerror = ng; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, ng } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? ng(new Error(JSON.stringify(msg.error))) : ok(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, ng) => {
    id += 1; pending.set(id, { ok, ng });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  const { frameTree } = await s('Page.getFrameTree');
  const frameId = frameTree.frame.id;
  return {
    async shot(markup) {
      await s('Page.setDocumentContent', { frameId, html: markup });
      await s('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
      const { data } = await s('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
      return Buffer.from(data, 'base64');
    },
    async close() {
      try { await send('Browser.close'); } catch { /* 終了済み */ }
      ws.close();
      await new Promise((ok) => { proc.once('exit', ok); setTimeout(ok, 3000); });
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* ロック中なら残す */ }
    },
  };
}

/* ---------- 本体 ---------- */
if (!existsSync(SPEC_FILE)) throw new Error('[images] image-specs.json がありません。先に node tools/media/generate.mjs を実行してください');
const specs = JSON.parse(readFileSync(SPEC_FILE, 'utf8'));
let hashes = {};
if (existsSync(HASH_FILE)) { try { hashes = JSON.parse(readFileSync(HASH_FILE, 'utf8')); } catch { hashes = {}; } }

const hashOf = (spec) => createHash('sha1').update(JSON.stringify([TEMPLATE_VERSION, spec])).digest('hex').slice(0, 16);
// --only <文字列> でパスに含むものだけ描く（見た目の確認用。削除は行わない）
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : '';
const todo = specs.filter((sp) => (!only || sp.path.includes(only))
  && (only || hashes[sp.path] !== hashOf(sp) || !existsSync(resolve(ROOT, sp.path))));

let drawn = 0;
if (todo.length) {
  const edge = await launchEdge();
  try {
    for (const sp of todo) {
      const out = resolve(ROOT, sp.path);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, await edge.shot(html(sp)));
      hashes[sp.path] = hashOf(sp);
      drawn += 1;
      if (drawn % 200 === 0) console.log(`[images] ${drawn}/${todo.length}`);
    }
  } finally {
    await edge.close();
  }
}

// もう使わない画像を消す（記事やハブを入れ替えたとき）
const keep = new Set(specs.map((sp) => sp.path));
let removed = 0;
const walk = (rel) => {
  const dir = resolve(ROOT, rel);
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.jpg') && !keep.has(p)) { rmSync(resolve(ROOT, p)); removed += 1; }
  }
};
if (!only) walk('media/img');
if (!only) for (const k of Object.keys(hashes)) if (!keep.has(k)) delete hashes[k];
writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 0), 'utf8');

console.log(`[images] 描画 ${drawn} / 全 ${specs.length}（削除 ${removed}）`);
