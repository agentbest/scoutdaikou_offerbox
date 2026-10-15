// tools/media/render.mjs … 「地方採用ラボ」の静的HTMLの外枠と、記事・一覧で使い回す部品。
//
// ⚠ media/ 配下はすべて生成物。直接編集しない（node tools/media/generate.mjs で作り直す）。
// ⚠ 見た目はコーポレート（www.agent-best.net/media/）と求人広告代理店メディア（saiyo-media.agent-best.net/media/）の
//    記事に揃えている（2026-10-15）。白地×#1C1C2E。LPのティールはメディアでは使わない。CSS は style.mjs。
// ⚠ 外部CDNは読まない（GA4 の gtag.js だけは例外。saiyo-media・コーポレートと同じプロパティ）。
//    CSS・JS は2,000ページで重複させないため /media/assets/ に切り出している。
// ⚠ 記事末フォームの送信先はLP（ルートの index.html）と同じGoogleフォーム・同じ entry ID。
//    LP側の entry ID を変えたら、ここの JS も直すこと。

import { esc } from './common.mjs';
export { CSS } from './style.mjs';

export const SITE = 'https://scoutdaikou-offerbox.agent-best.net';
export const MEDIA_NAME = '地方採用ラボ';
export const MEDIA_TAGLINE = '地方の中小・中堅企業のための、新卒採用ノウハウメディア';
export const COMPANY = '株式会社エージェントベスト';
export const CTA_URL = '/#entry';
const GA_ID = 'G-1XXMP8Y1B4';   // saiyo-media と同じプロパティ。サイト別はホスト名で分ける
const TIMEREX = 'https://timerex.net/s/r_matsuoka/6666f3b5/';

/* ---------------- 相談導線の文言 ----------------
 * 読者は地方の中小・中堅企業の採用担当者。記事のグループで悩みの入り口が違うので、文言を出し分ける。
 * ⚠ 金額は当社の運用代行（20万円／1名・完全成果報酬）だけ。媒体の料金・登録者数・最上級表現は書かない。
 * ⚠ 「必ず」「確実に」など成功を保証する表現を使わない。 */
const CTA_COPY = {
  base: {
    lead: '地方の新卒採用、スカウトで母集団をつくりませんか',
    points: ['知名度に頼らず、学生に直接オファーを送るOfferBoxの運用を代行します',
             '費用は入社承諾時のみの完全成果報酬（1名20万円）。成果が出なければ0円です',
             '地方の中小・中堅企業からのご相談も承っています'],
    label: '新卒採用の進め方を相談する', short: '地方の新卒採用を無料で相談',
    placeholder: '例：○○県で28卒を3名採用予定。説明会に学生が集まらないので、スカウトを試したい。' },
  issue: {
    lead: '採用の課題を、運用の側から一緒に整理しませんか',
    points: ['母集団・面談・内定辞退のどこで止まっているかを一緒に切り分けます',
             'OfferBoxの運用代行は入社承諾時のみ課金の完全成果報酬（1名20万円）',
             '人事が1人でも回る形を、ご相談のなかで一緒に考えます'],
    label: '採用の課題を相談する', short: '採用の課題を無料で相談',
    placeholder: '例：人事1人で新卒を担当している。承認はされるが面談につながらないので、運用を見直したい。' },
  dr: {
    lead: 'OfferBoxの運用、ひとりで抱えていませんか',
    points: ['検索条件・オファー文面・承認後の面談まで、いまの運用を一緒に点検します',
             '運用代行は入社承諾時のみ課金の完全成果報酬（1名20万円）',
             'これから始める場合も、導入前の設計からご相談いただけます'],
    label: 'OfferBoxの運用を相談する', short: 'OfferBoxの運用を無料で相談',
    placeholder: '例：28卒で5名採用予定。オファーの承認率が低いので、文面と検索条件を見直したい。' },
};
const copyOf = (group) => CTA_COPY[group] || CTA_COPY.base;
const TRUST = ['相談無料', '営業のお電話はしません', '完全成果報酬（1名20万円）', '厚生労働大臣許可 13-ユ-316964'];

/* ---------------- 共通レイアウト ---------------- */

// [グループkey, ヘッダーの短い表記, フッターの正式名]
const GROUP_NAV = [
  ['area', 'エリア', 'エリアから探す'],
  ['industry', '業種', '業種から探す'],
  ['issue', '採用の課題', '採用の課題から探す'],
  ['dr', 'スカウト採用', 'ダイレクトリクルーティング・OfferBox'],
  ['theme', '地方採用のテーマ', '地方採用のテーマ'],
];
const HEADER_NAV = ['area', 'industry', 'issue', 'dr'];

function head({ title, desc, canonical, ogType = 'website', extraJsonLd = [] }) {
  const ld = extraJsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#1C1C2E">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(MEDIA_NAME)}｜${esc(COMPANY)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/media/assets/media.css">
${ld}
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments)}
  gtag('js',new Date());
  gtag('config','${GA_ID}');
</script>
<script src="/media/assets/media.js" defer></script>
</head>
<body>
<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="/media/" aria-label="${esc(MEDIA_NAME)}">
      <img class="brand-logo" src="/logo.png" alt="${esc(COMPANY)}" width="508" height="120">
      <span class="brand-sub">${esc(MEDIA_NAME)}</span>
    </a>
    <nav class="nav-links">
      ${GROUP_NAV.filter(([k]) => HEADER_NAV.includes(k)).map(([k, l]) => `<a href="/media/category/${k}/">${esc(l)}</a>`).join('\n      ')}
      <a href="/media/search/">記事を探す</a>
    </nav>
    <a class="btn btn-primary cta-mini" href="${CTA_URL}" data-cta="nav">無料相談</a>
  </div>
</header>
`;
}

function foot() {
  return `<footer>
  <div class="wrap">
    <div class="foot-in">
      <div>
        <div class="foot-brand">${esc(MEDIA_NAME)}</div>
        <div style="margin-top:6px">${esc(MEDIA_TAGLINE)}</div>
      </div>
      <div class="foot-links">
        <a href="/media/">記事トップ</a>
        ${GROUP_NAV.map(([k, , full]) => `<a href="/media/category/${k}/">${esc(full)}</a>`).join('\n        ')}
        <a href="/media/search/">記事を探す</a>
        <a href="/">OfferBox運用代行（完全成果報酬型）</a>
        <a href="${CTA_URL}" data-cta="footer">お問い合わせ</a>
        <a href="https://www.agent-best.net/" target="_blank" rel="noopener">運営会社</a>
      </div>
    </div>
    <div class="foot-links" style="margin-top:22px;font-size:.82rem">
      <a href="https://saiyo-media.agent-best.net/" target="_blank" rel="noopener">求人広告代理店 ↗</a>
      <a href="https://scout.agent-best.net/" target="_blank" rel="noopener">スカウト代行サービス ↗</a>
      <a href="https://green.agent-best.net/" target="_blank" rel="noopener">Green運用代行 ↗</a>
      <a href="https://infra.agent-best.net/" target="_blank" rel="noopener">Infra長期インターン採用代理店 ↗</a>
      <a href="https://eraberusaiyodaiko.com/" target="_blank" rel="noopener">採用代行マッチング「エラベル」 ↗</a>
    </div>
    <div class="foot-copy">OfferBoxは株式会社i-plugのサービスです。当社はOfferBoxの運用を代行する事業者であり、OfferBoxの運営者ではありません。<br>運営：${esc(COMPANY)}（東京都港区六本木4-8-7 嶋田ビル5階／有料職業紹介事業 許可番号 13-ユ-316964）</div>
  </div>
</footer>
</body>
</html>
`;
}

export function page(opts, body) {
  return head(opts) + body + foot();
}

/** 一覧・トップのパンくず */
export function crumb(items) {
  return `<nav class="crumb" aria-label="パンくず"><div class="wrap">`
    + items.map((x) => x.url ? `<a href="${x.url}">${esc(x.name)}</a>` : `<span>${esc(x.name)}</span>`).join('<i>›</i>')
    + `</div></nav>`;
}

/** 記事ページのパンくず（本文の幅に収める。コーポレートの記事と同じ形） */
export function articleCrumb(items) {
  return `<nav class="breadcrumb" aria-label="パンくず">`
    + items.filter((x) => x.url).map((x) => `<a href="${x.url}">${esc(x.name)}</a>`).join('<span aria-hidden="true">/</span>')
    + `</nav>`;
}

export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name,
      ...(it.url ? { item: SITE + it.url } : {}),
    })),
  };
}

/* ---------------- 記事末の相談フォーム ----------------
 * LPへ飛ばさず、その場で送れる短いフォーム（会社名・お名前・メール＋任意の相談内容）。
 * 送信は media.js。送信後はLPと同じくTimerexの日程予約を案内する（直リンクにはしない）。 */
export function ctaBlock(a) {
  const c = copyOf(a.group);
  return `<section class="consult" id="consult" aria-labelledby="consult-t">
  <div class="consult__head">
    <p class="consult__kick">相談無料 ／ OfferBox運用代行（完全成果報酬型）</p>
    <h2 class="consult__lead" id="consult-t">${esc(c.lead)}</h2>
    <ul class="consult__points">${c.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
  <form class="consult__form" data-consult novalidate data-from="${esc(a.slug)}" data-title="${esc(a.title)}" data-hub="${esc(a.hubLabel)}">
    <div class="cf-row">
      <label><span class="cf-l">会社名<span class="req">必須</span></span><input type="text" name="company" required autocomplete="organization"></label>
      <label><span class="cf-l">お名前<span class="req">必須</span></span><input type="text" name="name" required autocomplete="name"></label>
    </div>
    <label><span class="cf-l">メールアドレス<span class="req">必須</span></span><input type="email" name="email" required autocomplete="email"></label>
    <label><span class="cf-l">ご相談内容<span class="opt">任意</span></span><textarea name="message" rows="3" placeholder="${esc(c.placeholder)}"></textarea></label>
    <p class="cf-err" role="alert"></p>
    <button type="submit" class="btn btn-primary cf-submit">${esc(c.label)} →</button>
    <p class="cf-note">${TRUST.map(esc).join(' ／ ')}<br>送信いただいた情報は、お問い合わせ対応の目的にのみ利用いたします。</p>
  </form>
  <div class="consult__thanks" hidden>
    <p class="consult__lead">送信しました</p>
    <p>お問い合わせありがとうございます。内容を確認のうえ、担当者よりご連絡いたします。</p>
    <p>お急ぎの場合は、打ち合わせの日程を直接ご予約いただけます。<br><a href="${TIMEREX}" target="_blank" rel="noopener" data-cta="timerex">日程を選んで予約する ↗</a></p>
  </div>
</section>`;
}

/** スクロール途中で出る下部バー。#consult が見えたら隠れる（media.js） */
export function stickyCta(a) {
  const c = copyOf(a.group);
  return `<div class="sticky-cta" hidden>
  <p>${esc(c.short)}<span>成果が出るまで0円・相談だけでもOK</span></p>
  <a href="#consult" data-cta="sticky">相談する</a>
  <button type="button" class="sticky-cta__x" aria-label="閉じる">×</button>
</div>`;
}

/** 一覧・トップの相談バンド（LPのフォームへ） */
export function ctaBand(group, where) {
  const c = copyOf(group);
  return `<aside class="band">
  <div>
    <p class="band__lead">${esc(c.lead)}</p>
    <ul>${c.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
  <a class="btn btn-primary" href="${CTA_URL}" data-cta="${esc(where)}">${esc(c.label)} →</a>
</aside>`;
}

/* ---------------- 監修者・シェア（コーポレートの AuthorBlock / ShareButtons と同じ） ---------------- */
export const SNS = [
  ['X（Twitter）', 'https://x.com/r_matsuoka0919', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'],
  ['Facebook', 'https://www.facebook.com/ryouji.matsuoka919', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>'],
  ['LinkedIn', 'https://www.linkedin.com/in/%E8%89%AF%E6%AC%A1-%E6%9D%BE%E5%B2%A1-87bb9851/', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>'],
  ['note', 'https://note.com/ryouji_matsuoka', '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor"/><path d="M7.4 16.6V8.9h2.28v1.05c.5-.79 1.35-1.24 2.42-1.24 1.86 0 2.94 1.16 2.94 3.13v4.76h-2.35v-4.31c0-1.06-.5-1.63-1.42-1.63-.94 0-1.52.63-1.52 1.7v4.24z" fill="#f8fafb"/></svg>'],
];

export const AUTHOR = `<aside class="author">
  <p class="author__t">監修</p>
  <p class="author__n"><a href="https://www.agent-best.net/profile/" target="_blank" rel="noopener">松岡 良次</a></p>
  <p class="author__b">株式会社エージェントベスト代表。大手人材会社およびスタートアップ人材企業にて、IT・スタートアップ・メガベンチャー企業の採用支援に従事。独立後はIT・スタートアップ・コンサル領域に特化し、20〜30代のキャリア支援を行う。（厚生労働大臣許可 13-ユ-316964）</p>
  <div class="author__sns">${SNS.map(([n, u, svg]) => `<a href="${u}" target="_blank" rel="noopener" aria-label="${n}">${svg}</a>`).join('')}</div>
</aside>`;

export const AUTHOR_LD = {
  '@type': 'Person', name: '松岡 良次', url: 'https://www.agent-best.net/profile/',
  jobTitle: '代表取締役', worksFor: { '@id': 'https://www.agent-best.net/#organization' },
  sameAs: SNS.map((s) => s[1]),
};
export const PUBLISHER_LD = {
  '@type': 'Organization', '@id': 'https://www.agent-best.net/#organization',
  name: COMPANY, url: 'https://www.agent-best.net/',
  logo: { '@type': 'ImageObject', url: SITE + '/logo.png' },
};

export function shareHtml(url, title) {
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const ico = (d) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
  const svgOf = (n) => SNS.find((s) => s[0].startsWith(n))[2].match(/d="([^"]+)"/)[1];
  const btn = (key, name, href, icon) =>
    `<li><a class="share-btn share-btn--${key}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-share="${key}" aria-label="${name}でシェア" title="${name}でシェア">${icon}</a></li>`;
  return `<aside class="share" aria-label="シェア">
  <span class="share-label">この記事をシェア</span>
  <ul class="share-list">
    ${btn('x', 'X', `https://x.com/intent/post?url=${u}&text=${t}`, ico(svgOf('X')))}
    ${btn('facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`, ico(svgOf('Facebook')))}
    ${btn('linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, ico(svgOf('LinkedIn')))}
    ${btn('hatena', 'はてなブックマーク', `https://b.hatena.ne.jp/entry/panel/?url=${u}&btitle=${t}`, '<span class="share-hb" aria-hidden="true">B!</span>')}
    <li><button type="button" class="share-btn share-btn--copy" data-share="copy" data-share-url="${esc(url)}" aria-label="リンクをコピー" title="リンクをコピー"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button></li>
  </ul>
  <span class="share-done" role="status" aria-live="polite"></span>
</aside>`;
}

/* ---------------- JS（記事末フォーム・下部バー・シェア・計測） ----------------
 * GA4 のイベント: cta_click（data-cta の場所）／ form_start ／ generate_lead（送信成功。form_location=article）／ share
 * ⚠ String.raw にしてある（正規表現のバックスラッシュを残すため）。中で ${} を使わない。 */
export const JS = String.raw`(function(){
  var FORM_ACTION='https://docs.google.com/forms/d/e/1FAIpQLSd8Zk9Rxsg292K8R_ttnRYa5d4uXMBkSFrnlEVTFts6feRx6g/formResponse';
  var ENTRY={company:'entry.1620407772',name:'entry.2140471957',email:'entry.417521654',message:'entry.1952858857'};
  var SOURCE='地方採用ラボ 記事内フォーム（scoutdaikou-offerbox.agent-best.net/media/）';
  function ev(name,params){try{if(window.gtag)gtag('event',name,params||{});}catch(e){}}

  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('[data-cta]');
    if(a)ev('cta_click',{cta_location:a.getAttribute('data-cta'),page_path:location.pathname});
  });

  document.addEventListener('click',function(e){
    var el=e.target.closest&&e.target.closest('[data-share]');if(!el)return;
    var kind=el.getAttribute('data-share');ev('share',{method:kind,content_type:'article'});
    if(kind!=='copy')return;
    e.preventDefault();
    var url=el.getAttribute('data-share-url')||location.href, box=el.closest('.share').querySelector('.share-done');
    var done=function(t){if(box){box.textContent=t;setTimeout(function(){box.textContent='';},2200);}};
    if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){done('コピーしました');},function(){done('コピーできませんでした');});
    else done('コピーできませんでした');
  });

  var forms=document.querySelectorAll('form[data-consult]');
  Array.prototype.forEach.call(forms,function(form){
    var box=form.parentNode, thanks=box.querySelector('.consult__thanks');
    var err=form.querySelector('.cf-err'), btn=form.querySelector('.cf-submit'), label=btn.textContent;
    var started=false;
    form.addEventListener('input',function(){if(!started){started=true;ev('form_start',{form_location:'article',page_path:location.pathname});}});
    form.addEventListener('submit',function(e){
      e.preventDefault();
      err.textContent='';
      var v=function(n){return (form.elements[n].value||'').trim();};
      var company=v('company'),name=v('name'),email=v('email'),message=v('message');
      if(!company||!name||!email){err.textContent='会社名・お名前・メールアドレスをご入力ください。';return;}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='メールアドレスの形式をご確認ください。';return;}
      btn.disabled=true;btn.textContent='送信中...';
      var data=new FormData();
      data.append(ENTRY.company,company);
      data.append(ENTRY.name,name);
      data.append(ENTRY.email,email);
      data.append(ENTRY.message,(message||'（相談内容の記入なし）')
        +'\n\nカテゴリ：'+form.getAttribute('data-hub')
        +'\n読んでいた記事：'+form.getAttribute('data-title')+'\n'+location.origin+location.pathname
        +'\n\n---\nお問い合わせ元：'+SOURCE);
      fetch(FORM_ACTION,{method:'POST',mode:'no-cors',body:data})
        .then(function(){
          form.hidden=true;thanks.hidden=false;
          ev('generate_lead',{form_location:'article',article:form.getAttribute('data-from'),page_path:location.pathname});
          thanks.scrollIntoView({behavior:'smooth',block:'center'});
          var bar=document.querySelector('.sticky-cta');if(bar)bar.hidden=true;
        })
        .catch(function(){
          btn.disabled=false;btn.textContent=label;
          err.textContent='送信に失敗しました。お手数ですが、時間をおいて再度お試しください。';
        });
    });
  });

  /* 下部バー: 少し読み進めたら出し、相談ブロックの上端が画面に入ったら隠す。閉じたらそのタブでは出さない */
  var bar=document.querySelector('.sticky-cta'), consult=document.getElementById('consult');
  if(bar&&consult){
    var closed=false;
    try{closed=sessionStorage.getItem('sticky-cta-closed')==='1';}catch(e){}
    var update=function(){
      var reached=consult.getBoundingClientRect().top<window.innerHeight;
      bar.hidden=closed||reached||window.scrollY<700;
    };
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update);
    bar.querySelector('.sticky-cta__x').addEventListener('click',function(){
      closed=true;update();try{sessionStorage.setItem('sticky-cta-closed','1');}catch(e){}
    });
    update();
  }
})();
`;
