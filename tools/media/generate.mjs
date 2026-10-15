// tools/media/generate.mjs … 「地方採用ラボ」（/media/）の全ページを生成する。
//
//   node tools/media/generate.mjs
//
// 出力（すべて生成物。直接編集しない）:
//   media/index.html                   … メディアトップ（5グループ）
//   media/category/{group}/index.html  … グループ一覧（ハブのカード）
//   media/hub/{hub}/index.html         … ハブ一覧（そのハブの記事）
//   media/{slug}/index.html            … 記事 2,000本
//   media/search/index.html + search.json … 記事検索（インデックスは遅延fetch）
//   media/assets/media.css             … 共通CSS（render.mjs の CSS 定数の写し）
//   sitemap.xml / robots.txt           … ルート（LPのトップも含む）
//   tools/media/image-specs.json       … アイキャッチ・OGP画像の描画指示（画像そのものは images.mjs が作る）
//
// ⚠ 記事・ハブを変えたら、続けて node tools/media/images.mjs を実行する（ページは画像を必ず参照するため）。
//
// ⚠ 乱数は seed 固定。再生成しても同じ記事になるので、差分レビューができる。
// ⚠ 公開日は tools/media/first-seen.json に積み上げる（jobsite の first-seen と同じ考え方）。
//    消すと全記事の公開日が再生成日に化けるので消さないこと。
// ⚠ 統計値は本文に書かない。静的サイトなので更新されず、古い数字が2,000ページに残る。

import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HUBS, GROUPS, GROUP_LABEL, BLOCKS } from './hubs.mjs';
import { PREF_BY_SLUG, BLOCK_LABEL } from './prefectures.mjs';
import { HUB_POINTS } from './hub-points.mjs';
import { AREA_ANGLES } from './angles-area.mjs';
import { AREA_ANGLES_2 } from './angles-area2.mjs';
import { INDUSTRY_ANGLES } from './angles-industry.mjs';
import { ISSUE_ANGLES } from './angles-issue.mjs';
import { DR_ANGLES } from './angles-dr.mjs';
import { THEME_ANGLES } from './angles-theme.mjs';
import { rngFor, PREMISE, CLOSERS, CAUTIONS, esc, ul, localizePref } from './common.mjs';
import { qaSection, applySection, misreadSection, relatedHubs, hubFactsSection } from './deepen.mjs';
import { AREA_ALTS } from './angle-alts-area.mjs';
import { AREA_ALTS_2 } from './angle-alts-area2.mjs';
import { INDUSTRY_ALTS } from './angle-alts-industry.mjs';
import { ISSUE_ALTS } from './angle-alts-issue.mjs';
import { DR_ALTS } from './angle-alts-dr.mjs';
import { THEME_ALTS } from './angle-alts-theme.mjs';
import { CSS, JS, SITE, MEDIA_NAME, MEDIA_TAGLINE, page, crumb, articleCrumb, breadcrumbLd, ctaBlock, ctaBand, stickyCta,
  shareHtml, AUTHOR, AUTHOR_LD, PUBLISHER_LD } from './render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = resolve(ROOT, 'media');
const SEEN_FILE = resolve(HERE, 'first-seen.json');

// 切り口の「全ハブで同じ文になる段落」に持たせた言い換えの変種。
// キーは "切り口slug:セクション番号:段落番号"（angle-alts-*.mjs の冒頭を参照）。
// ⚠ グループごとに分けて持つ。切り口のslugはグループをまたぐと重複するため
//   （issue と dr の basics、industry と issue と dr の local など）、
//   一つのオブジェクトに混ぜると別グループの文面が差し込まれる。
const ALTS = {
  area: { ...AREA_ALTS, ...AREA_ALTS_2 },
  industry: INDUSTRY_ALTS,
  issue: ISSUE_ALTS,
  dr: DR_ALTS,
  theme: THEME_ALTS,
};
const ALTS_USED = new Set();

const ANGLES = {
  area: [...AREA_ANGLES, ...AREA_ANGLES_2],
  industry: INDUSTRY_ANGLES,
  issue: ISSUE_ANGLES,
  dr: DR_ANGLES,
  theme: THEME_ANGLES,
};

/* ---------- ハブごとの文脈 ---------- */
function contextOf(hub) {
  const base = {
    group: hub.group,
    hub: hub.slug,
    hubLabel: hub.label,
    subject: hub.subject,
    note: hub.note,
    points: HUB_POINTS[hub.slug] ?? [],
    roles: hub.roles ?? [],
  };
  if (hub.group === 'area') {
    const p = PREF_BY_SLUG.get(hub.pref);
    const w = { hokkaido: ['道内', '道外'], tokyo: ['都内', '都外'], osaka: ['府内', '府外'], kyoto: ['府内', '府外'] }[p.slug] ?? ['県内', '県外'];
    return { ...base, short: p.short, blockLabel: BLOCK_LABEL[p.block], capital: p.capital,
      cities: p.cities, industries: p.industries, universities: p.universities,
      inPref: w[0], outPref: w[1] };
  }
  return { ...base, short: hub.subject, cities: [], industries: [], universities: [] };
}

/* ---------- 記事1本 ---------- */
function buildArticle(hub, angle, serial) {
  const c = contextOf(hub);
  const r = rngFor(serial * 7919 + 31);

  const sections = angle.sections(c, r).map((s, si) => ({
    h: s.h,
    // 変種を持つ位置は「元の文 ＋ 変種」から1つ選ぶ。持たない位置はそのまま。
    p: s.p
      .map((f) => (typeof f === 'function' ? f() : f))
      .filter(Boolean)
      .map((text, pi) => {
        const key = `${angle.slug}:${si}:${pi}`;
        const alt = ALTS[hub.group]?.[key];
        if (!alt) return text;
        ALTS_USED.add(`${hub.group}:${key}`);
        return r.pick([() => text, ...alt])(c);
      }),
    list: typeof s.list === 'function' ? s.list(c) : s.list,
  }));

  // 注意書きは2つ目のセクションの後ろに1つだけ挟む（断定を避けるため）
  const caution = r.pick(CAUTIONS)();
  if (sections.length >= 2) sections[1].p.push(caution);

  // 切り口ごとの章立てだけでは1記事800字前後にしかならないので、
  // ハブ固有の前提 → よくある誤解 → 自社に当てはめる → よくある質問 を後半に足す。
  // ハブ固有の前提は「同じ切り口の記事が県ごとに入れ替わる」ための軸でもある。
  sections.push(hubFactsSection(c, r));
  sections.push(misreadSection(c, r));
  sections.push(applySection(c, r));

  const qa = qaSection(c, r);
  const relHubs = relatedHubs(hub, HUBS, PREF_BY_SLUG, r);

  const lead = r.pick(PREMISE)();
  const closer = r.pick(CLOSERS)();

  const tags = Array.from(new Set([...(angle.tags ?? []), hub.label, GROUP_LABEL[hub.group]]));

  // 北海道・東京都・大阪府・京都府では「県内／県外」が不自然になるので言い換える
  if (hub.group === 'area') {
    const L = (t) => localizePref(t, hub.pref);
    for (const s of sections) {
      s.p = s.p.map(L);
      if (s.list) s.list = s.list.map(L);
      if (s.after) s.after = s.after.map(L);
    }
    qa.qa = qa.qa.map((x) => ({ q: L(x.q), a: L(x.a) }));
  }

  return {
    qa,
    relHubs: relHubs.map((h) => ({ slug: h.slug, label: h.label, note: h.note, group: h.group })),
    slug: `${hub.slug}-${angle.slug}`,
    hub: hub.slug,
    hubLabel: hub.label,
    group: hub.group,
    angle: angle.slug,
    title: angle.title(c),
    desc: angle.desc(c),
    lead,
    closer,
    sections,
    tags,
  };
}

/* ---------- 全記事 ---------- */
const articles = [];
let serial = 0;
for (const hub of HUBS) {
  const pool = ANGLES[hub.group];
  if (!pool) throw new Error(`[media] グループ ${hub.group} の切り口が未定義です`);
  if (pool.length !== hub.articles) {
    throw new Error(`[media] ${hub.slug}: 記事本数 ${hub.articles} と切り口の数 ${pool.length} が合いません`);
  }
  if (hub.group !== 'area' && hub.group !== 'industry' && !HUB_POINTS[hub.slug]) {
    throw new Error(`[media] ${hub.slug} の points が hub-points.mjs にありません`);
  }
  for (const angle of pool) {
    serial += 1;
    articles.push(buildArticle(hub, angle, serial));
  }
}

/* ---------- 統合（2026-10-16） ----------
 * 内容が重なる記事を1本にまとめた。
 *   retired.json … 転送する記事 {slug: 転送先URL}。記事は作らず、転送ページだけ置く（一覧・検索・sitemapから外す）
 *   imported/<slug>.json … saiyo-media（求人広告代理店メディア）の手書き記事の本文を、この記事に移したもの。
 *                          切り口の生成文の代わりにこの本文を出す。元の saiyo-media 記事はこの記事へ転送している
 * 対応表は saiyo-media の media-redirects.json と対。片方だけ直さない。 */
const RETIRED = JSON.parse(readFileSync(resolve(HERE, 'retired.json'), 'utf8'));
const IMPORTED_DIR = resolve(HERE, 'imported');
const retiredArts = [];
for (let i = articles.length - 1; i >= 0; i -= 1) {
  if (RETIRED[articles[i].slug]) retiredArts.push(...articles.splice(i, 1));
}
for (const a of articles) {
  const f = resolve(IMPORTED_DIR, `${a.slug}.json`);
  if (!existsSync(f)) continue;
  a.imported = JSON.parse(readFileSync(f, 'utf8'));
  a.title = a.imported.title;
  a.desc = a.imported.desc;
}
// ハブ・グループの本数表示は、転送した記事を除いた数にする（切り口との突き合わせは上で済んでいる）
for (const hub of HUBS) hub.articles = articles.filter((a) => a.hub === hub.slug).length;

/* ---------- 公開日（初出日を積み上げる） ---------- */
const today = new Date().toISOString().slice(0, 10);
let seen = {};
if (existsSync(SEEN_FILE)) { try { seen = JSON.parse(readFileSync(SEEN_FILE, 'utf8')); } catch { seen = {}; } }
let newCount = 0;
for (const a of articles) {
  if (!seen[a.slug]) { seen[a.slug] = today; newCount += 1; }
  a.pubDate = seen[a.slug];
}
writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 0), 'utf8');

/* ---------- 出力ヘルパー ---------- */
const write = (rel, html) => {
  const p = resolve(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html, 'utf8');
};

const artUrl = (a) => `/media/${a.slug}/`;
const hubUrl = (h) => `/media/hub/${h}/`;
const catUrl = (g) => `/media/category/${g}/`;

// アイキャッチ・OGP画像。パスと描画内容を image-specs.json に積み、images.mjs が PNG にする
const imgSpecs = [];
const artImg = (a) => `/media/img/${a.slug}.jpg`;
const ogImg = (name) => `/media/img/og/${name}.jpg`;
const addImg = (url, spec) => { imgSpecs.push({ path: url.slice(1), ...spec }); return url; };

const byHub = new Map();
for (const a of articles) {
  if (!byHub.has(a.hub)) byHub.set(a.hub, []);
  byHub.get(a.hub).push(a);
}

// 2026-09-12 → 2026/9/12（コーポレートの記事と同じ見え方）
const jpDate = (s) => `${s.slice(0, 4)}/${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

// 一覧の1行（タイトル＋説明＋カテゴリ）。コーポレート・saiyo-media の一覧と同じ形
const acard = (a) => `<li><a href="${artUrl(a)}">
      <span class="art-title">${esc(a.title)}</span>
      <span class="art-desc">${esc(a.desc)}</span>
      <span class="art-meta"><span class="tag">${esc(a.hubLabel)}</span><span class="theme">${esc(GROUP_LABEL[a.group])}</span></span>
    </a></li>`;
const artList = (list) => `<ul class="art-list">${list.map(acard).join('')}</ul>`;
const hubCard = (h) => `<a class="hubcard" href="${hubUrl(h.slug)}"><span class="t">${esc(h.label)}</span><span class="c">${h.articles}本</span></a>`;

const DISCLAIMER = `この記事は、${'株式会社エージェントベスト'}が新卒採用の支援で得た知見をもとに構成した実務向けの解説です。特定の企業の事例や、年によって変動する統計値は扱っていません。制度・市況・各サービスの仕様は変わりますので、実際の判断にあたっては一次情報をご確認ください。`;

/* ---------- 記事ページ ---------- */
let bodies = [];
for (const a of articles) {
  const crumbs = [
    { name: MEDIA_NAME, url: '/media/' },
    { name: GROUP_LABEL[a.group], url: catUrl(a.group) },
    { name: a.hubLabel, url: hubUrl(a.hub) },
    { name: a.title },
  ];
  const siblings = (byHub.get(a.hub) ?? []).filter((x) => x.slug !== a.slug);
  const related = siblings.slice(0, 6);

  // 見出しに id を振って目次を作る（目次はコーポレートの記事と同じく h2 だけ）
  const heads = [];
  const h2 = (text) => { const id = `h${heads.length + 1}`; heads.push({ id, text }); return `<h2 id="${id}">${esc(text)}</h2>`; };

  const secHtml = a.sections.map((s) =>
    `${h2(s.h)}${s.p.map((t) => `<p>${esc(t)}</p>`).join('')}${s.list ? ul(s.list) : ''}` +
    ((s.after ?? []).map((t) => `<p>${esc(t)}</p>`).join(''))
  ).join('\n');

  const qaHtml = h2(a.qa.h) + a.qa.qa.map((x) =>
    `<h3 class="qa-q">${esc(x.q)}</h3><p>${esc(x.a)}</p>`
  ).join('');

  // 内部リンク。ハブの note の1文目を添えて、リンク先で何が読めるか分かるようにする
  const relHubHtml = h2('あわせて読みたい') + `<ul class="hublinks">${a.relHubs.map((h) =>
    `<li><a href="${hubUrl(h.slug)}">${esc(h.label)}</a><span>${esc(h.note.split('。')[0])}。</span></li>`).join('')}</ul>`;

  const closerHtml = h2('この記事のまとめ') + `<p>${esc(a.closer)}</p>`;

  // 移した本文は見出しに id（h1, h2…）が振ってあるので、目次はそこから作る
  const imp = a.imported;
  const impHeads = imp ? [...imp.html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, '') })) : [];
  const relHubImp = imp ? `<h2 id="rel">あわせて読みたい</h2><ul class="hublinks">${a.relHubs.map((h) =>
    `<li><a href="${hubUrl(h.slug)}">${esc(h.label)}</a><span>${esc(h.note.split('。')[0])}。</span></li>`).join('')}</ul>` : '';
  const tocHeads = imp ? impHeads : heads;
  const toc = `<nav class="toc" aria-label="目次"><p class="toc__t">目次</p><ol>`
    + tocHeads.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('') + `</ol></nav>`;

  const bodyText = imp ? imp.html.replace(/<[^>]+>/g, '') :
    a.sections.map((s) => s.p.join('') + (s.list ?? []).join('') + (s.after ?? []).join('')).join('') +
    a.qa.qa.map((x) => x.q + x.a).join('') + a.lead + a.closer;
  bodies.push(bodyText);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.desc,
    inLanguage: 'ja',
    datePublished: a.pubDate,
    dateModified: a.imported ? '2026-10-16' : a.pubDate,
    mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + artUrl(a) },
    url: SITE + artUrl(a),
    author: AUTHOR_LD,
    publisher: PUBLISHER_LD,
    image: SITE + artImg(a),
    articleSection: GROUP_LABEL[a.group],
    keywords: a.tags.join(','),
  };

  // 並びはコーポレート・saiyo-media の記事と同じ：パンくず→タイトル→メタ→目次→本文→注記→相談→シェア→同じカテゴリ→監修
  const body = `<main class="wrap article">
  ${articleCrumb(crumbs)}
  <img class="eyecatch" src="${artImg(a)}" alt="" width="1200" height="630">
  <h1>${esc(a.title)}</h1>
  <p class="meta">
    <a class="meta-hub" href="${hubUrl(a.hub)}">${esc(a.hubLabel)}</a><a class="meta-theme" href="${catUrl(a.group)}">${esc(GROUP_LABEL[a.group])}</a>
    <span class="meta-date">公開日 ${jpDate(a.pubDate)}</span>
  </p>
  ${imp ? '' : `<p class="lead-box">${esc(a.lead)}</p>`}
  ${toc}
  <div class="body">
${imp ? imp.html + '\n' + relHubImp : `${secHtml}
${qaHtml}
${relHubHtml}
${closerHtml}`}
  </div>
  ${imp && imp.sources ? `<div class="sources">${imp.sources}</div>
  ` : ''}<div class="sources"><strong>この記事について</strong><p>${esc(DISCLAIMER)}</p><p class="lic">株式会社エージェントベスト／有料職業紹介事業 許可番号 13-ユ-316964</p></div>
  ${ctaBlock(a)}
  ${shareHtml(SITE + artUrl(a), a.title)}
  <section class="same-hub"><h2 class="block-title">${esc(a.hubLabel)}の他の記事</h2>
    ${artList(related)}
    <p class="more"><a href="${hubUrl(a.hub)}">${esc(a.hubLabel)}の記事をすべて見る →</a></p>
  </section>
  ${AUTHOR}
</main>
${stickyCta(a)}`;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (imp ? imp.faq : a.qa.qa).map((x) => ({
      '@type': 'Question', name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };

  write(`media/${a.slug}/index.html`, page({
    title: `${a.title}｜${MEDIA_NAME}`,
    desc: a.desc,
    canonical: SITE + artUrl(a),
    ogType: 'article',
    ogImage: addImg(artImg(a), { title: a.title, tag: a.hubLabel, groupLabel: GROUP_LABEL[a.group], group: a.group }),
    extraJsonLd: [breadcrumbLd(crumbs), articleLd, faqLd],
  }, body));
}

/* ---------- 転送ページ（統合した記事） ----------
 * GitHub Pages ではサーバー側の301が使えないので、canonical＋meta refresh＋location.replace で転送する。
 * noindex は付けない（canonical で評価を寄せる）。 */
for (const a of retiredArts) {
  const to = RETIRED[a.slug];
  write(`media/${a.slug}/index.html`, `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<title>移転しました｜${esc(MEDIA_NAME)}</title>
<link rel="canonical" href="${esc(to)}">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<script>location.replace(${JSON.stringify(to)});</script>
</head><body><p>この記事は内容の近い記事にまとめました。<a href="${esc(to)}">${esc(to)}</a> へ移動します。</p></body></html>
`);
}

/* ---------- ハブページ ---------- */
for (const hub of HUBS) {
  const list = byHub.get(hub.slug) ?? [];
  const crumbs = [
    { name: MEDIA_NAME, url: '/media/' },
    { name: GROUP_LABEL[hub.group], url: catUrl(hub.group) },
    { name: hub.label },
  ];
  const body = `${crumb(crumbs)}
<main class="wrap listing">
  <h1>${esc(hub.label)}</h1>
  <p class="lead">${esc(hub.note)}</p>
  <p class="count">${list.length}件</p>
  ${artList(list)}
  ${ctaBand(hub.group, `hub-${hub.slug}`)}
</main>`;
  write(`media/hub/${hub.slug}/index.html`, page({
    title: `${hub.label}の記事一覧｜${MEDIA_NAME}`,
    // note は複数文あることがあるので、1文目だけを説明文に使う（途中で切れるのを避ける）
    desc: `${hub.label}に関する記事${list.length}本。${hub.note.split('。')[0]}。`,
    canonical: SITE + hubUrl(hub.slug),
    ogImage: addImg(ogImg(`hub-${hub.slug}`), { title: `${hub.label}｜記事一覧（${list.length}本）`, tag: GROUP_LABEL[hub.group], groupLabel: '', group: hub.group }),
    extraJsonLd: [breadcrumbLd(crumbs)],
  }, body));
}

/* ---------- グループページ ---------- */
// グループの切り替え（コーポレート・saiyo-media の柱ナビと同じピル型）
const groupNav = (active) => `<nav class="pnav"><a href="/media/"${active === '' ? ' class="on"' : ''}>すべて</a>`
  + GROUPS.map((g) => `<a href="${catUrl(g.key)}"${g.key === active ? ' class="on"' : ''}>${esc(g.label)}</a>`).join('') + `</nav>`;
for (const g of GROUPS) {
  const hubs = HUBS.filter((h) => h.group === g.key);
  const total = hubs.reduce((n, h) => n + h.articles, 0);
  const crumbs = [{ name: MEDIA_NAME, url: '/media/' }, { name: g.label }];

  let inner;
  if (g.key === 'area') {
    // エリアだけは地域ブロックで区切る（47枚が並ぶだけでは探せないため）
    inner = BLOCKS.map((b) => {
      const hs = hubs.filter((h) => PREF_BY_SLUG.get(h.pref).block === b.key);
      if (!hs.length) return '';
      return `<p class="blocklabel">${esc(b.label)}</p>
        <div class="hubgrid">${hs.map(hubCard).join('')}</div>`;
    }).join('');
  } else {
    inner = `<div class="hubgrid">${hubs.map(hubCard).join('')}</div>`;
  }

  const body = `${crumb(crumbs)}
<main class="wrap listing">
  <h1>${esc(g.label)}</h1>
  <p class="lead">${esc(g.lead)}</p>
  ${groupNav(g.key)}
  <p class="count">${hubs.length}カテゴリ／${total}件</p>
  ${inner}
  ${ctaBand(g.key, `category-${g.key}`)}
</main>`;
  write(`media/category/${g.key}/index.html`, page({
    title: `${g.label}｜${MEDIA_NAME}`,
    desc: g.lead,
    canonical: SITE + catUrl(g.key),
    ogImage: addImg(ogImg(`category-${g.key}`), { title: `${g.label}｜${hubs.length}カテゴリ・記事${total}本`, tag: '記事カテゴリ', groupLabel: '', group: g.key }),
    extraJsonLd: [breadcrumbLd(crumbs)],
  }, body));
}

/* ---------- メディアトップ ---------- */
{
  const hubCount = HUBS.length;
  const latest = articles.slice(0, 0); // 全記事が同時公開なので「新着」は出さない
  // 入口の並びは読者（地方の採用担当者）の探し方の順：課題→エリア→業種→スカウト採用→テーマ。
  // エリアは47都道府県を地域ブロックで区切って全部出す（16件だけ出すと自県が見つからない）。
  const ORDER = ['issue', 'area', 'industry', 'dr', 'theme'];
  const groupSec = (g) => {
    const hubs = HUBS.filter((h) => h.group === g.key);
    const total = hubs.reduce((n, h) => n + h.articles, 0);
    const grid = g.key === 'area'
      ? BLOCKS.map((b) => {
          const hs = hubs.filter((h) => PREF_BY_SLUG.get(h.pref).block === b.key);
          return hs.length ? `<p class="blocklabel">${esc(b.label)}</p><div class="hubgrid">${hs.map(hubCard).join('')}</div>` : '';
        }).join('')
      : `<div class="hubgrid">${hubs.map(hubCard).join('')}</div>`;
    return `<section class="msec" id="${g.key}">
      <h2>${esc(g.label)}</h2>
      <p class="msec__note">${esc(g.lead)}（${hubs.length}カテゴリ・${total}本）</p>
      ${grid}
      <p class="more"><a href="${catUrl(g.key)}">${esc(g.label)}の一覧へ →</a></p>
    </section>`;
  };
  const G = Object.fromEntries(GROUPS.map((g) => [g.key, g]));

  const body = `${crumb([{ name: 'OfferBox運用代行', url: '/' }, { name: MEDIA_NAME }])}
<main class="mtop">
  <div class="wrap">
    <section class="mhero">
      <h1>${esc(MEDIA_NAME)}</h1>
      <p class="mhero__lead">知名度でも予算でも大手に及ばない地方の中小・中堅企業が、それでも新卒を採るために何をすればいいのか。都道府県・業種・採用の課題・スカウト採用の切り口で、<strong>${articles.length.toLocaleString('en-US')}本</strong>（${hubCount}カテゴリ）の記事にまとめています。運営は、OfferBox運用代行を完全成果報酬型で提供する株式会社エージェントベストです。</p>
      <nav class="jump" aria-label="記事の探し方">
        ${ORDER.map((k) => `<a href="#${k}">${esc(G[k].label)}</a>`).join('')}<a href="/media/search/">キーワードで探す</a>
      </nav>
      <aside class="cta-inline">
        <p>読んでも自社でどう動くか決めきれないときは、採用人数・時期・体制からスカウトの進め方を一緒に整理します（相談無料・成果が出るまで0円）。</p>
        <a href="/#entry" data-cta="media-top-hero">無料で相談する</a>
      </aside>
    </section>

    ${ORDER.slice(0, 2).map((k) => groupSec(G[k])).join('\n    ')}

    ${ctaBand('base', 'media-top-mid')}

    ${ORDER.slice(2).map((k) => groupSec(G[k])).join('\n    ')}

    ${ctaBand('dr', 'media-top-end')}
  </div>
</main>`;

  write('media/index.html', page({
    title: `${MEDIA_NAME}｜${MEDIA_TAGLINE}`,
    desc: `地方の中小・中堅企業に向けた新卒採用のノウハウメディア。都道府県・業種・採用課題・ダイレクトリクルーティングの切り口で${articles.length.toLocaleString('en-US')}本の記事を公開しています。`,
    canonical: `${SITE}/media/`,
    ogImage: addImg(ogImg('top'), { title: `地方の中小・中堅企業のための新卒採用ノウハウ｜都道府県・業種・採用の課題・スカウト採用から${articles.length.toLocaleString('en-US')}本`, tag: '新卒採用ノウハウメディア', groupLabel: '', group: 'site', size: 58 }),
    extraJsonLd: [
      breadcrumbLd([{ name: MEDIA_NAME }]),
      { '@context': 'https://schema.org', '@type': 'WebSite', name: MEDIA_NAME, url: `${SITE}/media/`, inLanguage: 'ja',
        publisher: { '@type': 'Organization', name: '株式会社エージェントベスト', url: 'https://www.agent-best.net/' } },
    ],
  }, body));
  void latest;
}

/* ---------- 検索 ---------- */
{
  const index = articles.map((a) => [a.slug, a.title, a.desc, a.hubLabel, a.group, a.tags.join(' ')]);
  write('media/search.json', JSON.stringify({ generatedAt: new Date().toISOString(), items: index }));

  const groupOpts = GROUPS.map((g) => `<option value="${g.key}">${esc(g.label)}</option>`).join('');
  const body = `${crumb([{ name: MEDIA_NAME, url: '/media/' }, { name: '記事を探す' }])}
<main class="wrap listing">
  <h1>記事を探す</h1>
  <p class="lead">タイトル・説明・カテゴリ・タグから絞り込めます。</p>
  <div class="searchbox">
    <input id="sq" type="search" placeholder="例：母集団形成、スカウト文面、北海道" autocomplete="off" aria-label="キーワード">
    <select id="sg" aria-label="カテゴリ"><option value="">すべてのカテゴリ</option>${groupOpts}</select>
  </div>
  <p class="count" id="shits">読み込み中…</p>
  <ul class="art-list" id="sres"></ul>
  ${ctaBand('base', 'search')}
</main>
<script>
(function(){
  var q=document.getElementById('sq'),g=document.getElementById('sg'),
      hits=document.getElementById('shits'),res=document.getElementById('sres'),items=null;
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function render(){
    if(!items){return;}
    var kw=q.value.trim().toLowerCase(), gk=g.value;
    var out=items.filter(function(it){
      if(gk && it[4]!==gk) return false;
      if(!kw) return true;
      return (it[1]+' '+it[2]+' '+it[3]+' '+it[5]).toLowerCase().indexOf(kw)>=0;
    });
    hits.textContent=out.length+'件';
    res.innerHTML=out.slice(0,80).map(function(it){
      return '<li><a href="/media/'+it[0]+'/"><span class="art-title">'+esc(it[1])+'</span><span class="art-desc">'+esc(it[2])+'</span>'+
             '<span class="art-meta"><span class="tag">'+esc(it[3])+'</span></span></a></li>';
    }).join('')+(out.length>80?'<li><p class="count" style="padding:.9em .2em">他 '+(out.length-80)+' 件。キーワードで絞り込んでください。</p></li>':'');
  }
  fetch('/media/search.json').then(function(r){return r.json();}).then(function(d){
    items=d.items; hits.textContent=items.length+'件'; render();
  }).catch(function(){ hits.textContent='検索インデックスを読み込めませんでした。'; });
  q.addEventListener('input',render); g.addEventListener('change',render);
})();
</script>`;
  write('media/search/index.html', page({
    title: `記事を探す｜${MEDIA_NAME}`,
    desc: `${MEDIA_NAME}の記事をキーワードとカテゴリで絞り込めます。`,
    canonical: `${SITE}/media/search/`,
  }, body));
}

/* ---------- 古くなった生成物の掃除 ---------- */
// 切り口やハブを入れ替えると、前回まで作っていた記事ディレクトリが取り残される。
// 残すと sitemap に無いページが公開されたままになるので、ここで消す。
let removed = 0;
{
  const keep = new Set([...articles.map((a) => a.slug), ...retiredArts.map((a) => a.slug)]);
  const reserved = new Set(['hub', 'category', 'search', 'assets', 'img']);
  for (const name of readdirSync(OUT, { withFileTypes: true })) {
    if (!name.isDirectory() || reserved.has(name.name) || keep.has(name.name)) continue;
    rmSync(resolve(OUT, name.name), { recursive: true, force: true });
    removed += 1;
  }
  const hubKeep = new Set(HUBS.map((h) => h.slug));
  const hubDir = resolve(OUT, 'hub');
  for (const name of readdirSync(hubDir, { withFileTypes: true })) {
    if (!name.isDirectory() || hubKeep.has(name.name)) continue;
    rmSync(resolve(hubDir, name.name), { recursive: true, force: true });
    removed += 1;
  }
  // 公開日の台帳からも、もう無い記事の行を落とす
  for (const slug of Object.keys(seen)) if (!keep.has(slug)) delete seen[slug];
  writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 0), 'utf8');
}

/* ---------- 画像の描画指示 ---------- */
writeFileSync(resolve(HERE, 'image-specs.json'), JSON.stringify(imgSpecs), 'utf8');

/* ---------- CSS ---------- */
write('media/assets/media.css', CSS);
write('media/assets/media.js', JS);

/* ---------- sitemap / robots ---------- */
{
  const now = new Date().toISOString();
  const urls = [
    { loc: `${SITE}/`, pri: '1.0' },
    { loc: `${SITE}/media/`, pri: '0.9' },
    { loc: `${SITE}/media/search/`, pri: '0.3' },
    ...GROUPS.map((g) => ({ loc: SITE + catUrl(g.key), pri: '0.8' })),
    ...HUBS.map((h) => ({ loc: SITE + hubUrl(h.slug), pri: '0.7' })),
    ...articles.map((a) => ({ loc: SITE + artUrl(a), pri: '0.6', lastmod: a.pubDate })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod ?? now.slice(0, 10)}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
  writeFileSync(resolve(ROOT, 'sitemap.xml'), xml, 'utf8');
  writeFileSync(resolve(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');
}

/* ---------- 自己点検 ---------- */
{
  const slugs = new Set(articles.map((a) => a.slug));
  const dupSlug = articles.length - slugs.size;
  const dupBody = bodies.length - new Set(bodies).size;
  const dupTitle = articles.length - new Set(articles.map((a) => a.title)).size;
  const lens = bodies.map((b) => b.length);
  const avg = Math.round(lens.reduce((n, x) => n + x, 0) / lens.length);
  const min = Math.min(...lens);

  console.log(`生成: 記事 ${articles.length}本／ハブ ${HUBS.length}／グループ ${GROUPS.length}`);
  console.log(`公開日: 新規 ${newCount}本（既存は tools/media/first-seen.json の日付を維持）`);
  console.log(`slug重複: ${dupSlug}件、タイトル重複: ${dupTitle}件、本文の完全一致: ${dupBody}件`);
  console.log(`本文の平均文字数: ${avg}（最短 ${min}）`);
  console.log(`出力: ${OUT}/ ＋ sitemap.xml / robots.txt（不要になった生成物 ${removed}件を削除）`);

  // 章立てを入れ替えると変種のキーがずれて、黙って効かなくなる。使われなかったキーを名指しで出す。
  const allKeys = Object.entries(ALTS).flatMap(([g, m]) => Object.keys(m).map((k) => `${g}:${k}`));
  const unused = allKeys.filter((k) => !ALTS_USED.has(k));
  const variants = Object.values(ALTS).reduce(
    (n, m) => n + Object.values(m).reduce((x, a) => x + a.length, 0), 0);
  if (unused.length) {
    console.warn(`⚠ 使われなかった変種のキーが ${unused.length} 件あります（章立てとずれています）: ${unused.slice(0, 10).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`文面の変種: ${allKeys.length}箇所／${variants}本すべてが使われています`);
  }

  if (dupSlug || dupBody || dupTitle) {
    console.error('⚠ 重複があります。ハブ・切り口の定義を確認してください。');
    process.exitCode = 1;
  }
  if (min < 900) console.warn(`⚠ 本文が900字を下回る記事があります（最短 ${min}）。切り口の章立てを見直してください。`);
}
