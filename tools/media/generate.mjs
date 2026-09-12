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
//
// ⚠ 乱数は seed 固定。再生成しても同じ記事になるので、差分レビューができる。
// ⚠ 公開日は tools/media/first-seen.json に積み上げる（jobsite の first-seen と同じ考え方）。
//    消すと全記事の公開日が再生成日に化けるので消さないこと。
// ⚠ 統計値は本文に書かない。静的サイトなので更新されず、古い数字が2,000ページに残る。

import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
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
import { CSS, SITE, MEDIA_NAME, MEDIA_TAGLINE, page, crumb, breadcrumbLd, ctaBlock } from './render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = resolve(ROOT, 'media');
const SEEN_FILE = resolve(HERE, 'first-seen.json');

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

  const sections = angle.sections(c, r).map((s) => ({
    h: s.h,
    p: s.p.map((f) => (typeof f === 'function' ? f() : f)).filter(Boolean),
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

const byHub = new Map();
for (const a of articles) {
  if (!byHub.has(a.hub)) byHub.set(a.hub, []);
  byHub.get(a.hub).push(a);
}

const jpDate = (s) => `${s.slice(0, 4)}年${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`;

const acard = (a) => `<li class="acard">
  <a class="t" href="${artUrl(a)}">${esc(a.title)}</a>
  <p>${esc(a.desc)}</p>
  <div class="meta"><span>${esc(a.hubLabel)}</span><span>${a.pubDate}</span></div>
</li>`;

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

  const secHtml = a.sections.map((s) =>
    `<h2>${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t)}</p>`).join('')}${s.list ? ul(s.list) : ''}` +
    ((s.after ?? []).map((t) => `<p>${esc(t)}</p>`).join(''))
  ).join('');

  const qaHtml = `<h2>${esc(a.qa.h)}</h2>` + a.qa.qa.map((x) =>
    `<h3 style="margin:22px 0 0;font-size:1rem;font-weight:800;line-height:1.6">Q. ${esc(x.q)}</h3><p>${esc(x.a)}</p>`
  ).join('');

  // 内部リンク。ハブの note の1文目を添えて、リンク先で何が読めるか分かるようにする
  const relHubHtml = `<h2>あわせて読みたい</h2><ul class="mlist">${a.relHubs.map((h) =>
    `<li><a href="${hubUrl(h.slug)}">${esc(h.label)}</a>｜${esc(h.note.split('。')[0])}。</li>`).join('')}</ul>`;

  const bodyText =
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
    dateModified: a.pubDate,
    mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + artUrl(a) },
    author: { '@type': 'Organization', name: '株式会社エージェントベスト', url: 'https://www.agent-best.net/' },
    publisher: { '@type': 'Organization', name: '株式会社エージェントベスト', url: 'https://www.agent-best.net/' },
    articleSection: GROUP_LABEL[a.group],
    keywords: a.tags.join(','),
  };

  const body = `${crumb(crumbs)}
<main><div class="wrap narrow sec">
<article class="post">
  <h1>${esc(a.title)}</h1>
  <div class="postmeta"><span>公開日 ${jpDate(a.pubDate)}</span><span><a href="${hubUrl(a.hub)}">${esc(a.hubLabel)}</a></span><span><a href="${catUrl(a.group)}">${esc(GROUP_LABEL[a.group])}</a></span></div>
  <p class="lead">${esc(a.lead)}</p>
  ${secHtml}
  ${qaHtml}
  ${relHubHtml}
  <h2>この記事のまとめ</h2>
  <p>${esc(a.closer)}</p>
  <div class="tags">${a.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
  <p class="note">${esc(DISCLAIMER)}<br>株式会社エージェントベスト／有料職業紹介事業 許可番号 13-ユ-316964</p>
</article>
${ctaBlock()}
<section class="related">
  <h2>${esc(a.hubLabel)}の他の記事</h2>
  <ul class="alist">${related.map(acard).join('')}</ul>
  <p style="margin-top:12px"><a href="${hubUrl(a.hub)}">${esc(a.hubLabel)}の記事をすべて見る →</a></p>
</section>
</div></main>`;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: a.qa.qa.map((x) => ({
      '@type': 'Question', name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.a },
    })),
  };

  write(`media/${a.slug}/index.html`, page({
    title: `${a.title}｜${MEDIA_NAME}`,
    desc: a.desc,
    canonical: SITE + artUrl(a),
    extraJsonLd: [breadcrumbLd(crumbs), articleLd, faqLd],
  }, body));
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
<main><div class="wrap sec">
  <div class="sec-head" style="margin-bottom:18px">
    <h2 style="font-size:1.6rem">${esc(hub.label)}</h2>
    <p>${esc(hub.note)}</p>
    <p style="font-family:var(--mono);font-size:.78rem;color:var(--ink-faint);margin-top:10px">${list.length}本の記事</p>
  </div>
  <ul class="alist">${list.map(acard).join('')}</ul>
  ${ctaBlock()}
</div></main>`;
  write(`media/hub/${hub.slug}/index.html`, page({
    title: `${hub.label}の記事一覧｜${MEDIA_NAME}`,
    // note は複数文あることがあるので、1文目だけを説明文に使う（途中で切れるのを避ける）
    desc: `${hub.label}に関する記事${list.length}本。${hub.note.split('。')[0]}。`,
    canonical: SITE + hubUrl(hub.slug),
    extraJsonLd: [breadcrumbLd(crumbs)],
  }, body));
}

/* ---------- グループページ ---------- */
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
      return `<div class="blocklabel">${esc(b.label)}</div>
        <div class="hubgrid">${hs.map((h) => `<a class="hubcard" href="${hubUrl(h.slug)}"><div class="t">${esc(h.label)}</div><div class="c">${h.articles}本</div></a>`).join('')}</div>`;
    }).join('');
  } else {
    inner = `<div class="hubgrid">${hubs.map((h) => `<a class="hubcard" href="${hubUrl(h.slug)}"><div class="t">${esc(h.label)}</div><div class="c">${h.articles}本</div></a>`).join('')}</div>`;
  }

  const body = `${crumb(crumbs)}
<main><div class="wrap sec">
  <div class="sec-head" style="margin-bottom:20px">
    <h2 style="font-size:1.6rem">${esc(g.label)}</h2>
    <p>${esc(g.lead)}</p>
    <p style="font-family:var(--mono);font-size:.78rem;color:var(--ink-faint);margin-top:10px">${hubs.length}カテゴリ／${total}本の記事</p>
  </div>
  ${inner}
  ${ctaBlock()}
</div></main>`;
  write(`media/category/${g.key}/index.html`, page({
    title: `${g.label}｜${MEDIA_NAME}`,
    desc: g.lead,
    canonical: SITE + catUrl(g.key),
    extraJsonLd: [breadcrumbLd(crumbs)],
  }, body));
}

/* ---------- メディアトップ ---------- */
{
  const hubCount = HUBS.length;
  const latest = articles.slice(0, 0); // 全記事が同時公開なので「新着」は出さない
  const groupsHtml = GROUPS.map((g) => {
    const hubs = HUBS.filter((h) => h.group === g.key);
    const total = hubs.reduce((n, h) => n + h.articles, 0);
    const shown = g.key === 'area' ? hubs.slice(0, 16) : hubs;
    return `<section class="sec" style="padding:26px 0">
      <div class="ghead"><h2>${esc(g.label)}</h2><span class="n">${hubs.length}カテゴリ・${total}本</span>
        <span style="margin-left:auto"><a href="${catUrl(g.key)}">すべて見る →</a></span></div>
      <p style="color:var(--ink-soft);font-size:.92rem;margin-bottom:14px">${esc(g.lead)}</p>
      <div class="hubgrid">${shown.map((h) => `<a class="hubcard" href="${hubUrl(h.slug)}"><div class="t">${esc(h.label)}</div><div class="c">${h.articles}本</div></a>`).join('')}</div>
      ${shown.length < hubs.length ? `<p style="margin-top:12px"><a href="${catUrl(g.key)}">${esc(g.label)}をすべて見る（${hubs.length}カテゴリ） →</a></p>` : ''}
    </section>`;
  }).join('');

  const body = `<section class="mhero"><div class="wrap mhero-in">
  <span class="eyebrow">CHIHO SAIYO LAB ・ 地方の新卒採用を、実務の言葉で</span>
  <h1>地方の中小・中堅企業のための、<br>新卒採用ノウハウメディア。</h1>
  <p>知名度でも予算でも大手に及ばない会社が、それでも新卒を採るために何をすればいいのか。都道府県・業種・課題の3つの切り口から、実務に落とせる形でまとめています。運営は、OfferBox運用代行を完全成果報酬型で提供する株式会社エージェントベストです。</p>
  <div class="counts"><span><b>${articles.length.toLocaleString('en-US')}</b>本の記事</span><span><b>${hubCount}</b>カテゴリ</span><span><b>47</b>都道府県</span></div>
</div></section>
<main><div class="wrap">${groupsHtml}
  <div class="sec" style="padding-top:8px">${ctaBlock()}</div>
</div></main>`;

  write('media/index.html', page({
    title: `${MEDIA_NAME}｜${MEDIA_TAGLINE}`,
    desc: `地方の中小・中堅企業に向けた新卒採用のノウハウメディア。都道府県・業種・採用課題・ダイレクトリクルーティングの切り口で${articles.length.toLocaleString('en-US')}本の記事を公開しています。`,
    canonical: `${SITE}/media/`,
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
<main><div class="wrap sec">
  <div class="sec-head" style="margin-bottom:18px"><h2 style="font-size:1.6rem">記事を探す</h2>
    <p>タイトル・説明・カテゴリ・タグから絞り込めます。</p></div>
  <div class="searchbox">
    <input id="sq" type="search" placeholder="例：母集団形成、スカウト文面、北海道" autocomplete="off">
    <select id="sg"><option value="">すべてのカテゴリ</option>${groupOpts}</select>
  </div>
  <div id="shits">読み込み中…</div>
  <ul class="alist" id="sres"></ul>
</div></main>
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
      return '<li class="acard"><a class="t" href="/media/'+it[0]+'/">'+esc(it[1])+'</a><p>'+esc(it[2])+'</p>'+
             '<div class="meta"><span>'+esc(it[3])+'</span></div></li>';
    }).join('')+(out.length>80?'<li class="acard"><p>他 '+(out.length-80)+' 件。キーワードで絞り込んでください。</p></li>':'');
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

/* ---------- CSS ---------- */
write('media/assets/media.css', CSS);

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
  console.log(`出力: ${OUT}/ ＋ sitemap.xml / robots.txt`);

  if (dupSlug || dupBody || dupTitle) {
    console.error('⚠ 重複があります。ハブ・切り口の定義を確認してください。');
    process.exitCode = 1;
  }
  if (min < 900) console.warn(`⚠ 本文が900字を下回る記事があります（最短 ${min}）。切り口の章立てを見直してください。`);
}
void rmSync;
