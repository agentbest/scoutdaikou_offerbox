# scoutdaikou_offerbox — OfferBox運用代行LP（採用企業向け・B2B）

- 公開URL: https://scoutdaikou-offerbox.agent-best.net/ （GitHub Pages、`.nojekyll` ＋ `CNAME`）
- サービス: **OfferBox運用代行（完全成果報酬型）**。新卒採用したい企業向け。
- アクセント色: ティール `#0D7E93`
- リポジトリ構成は `index.html` / `CNAME` / `.nojekyll` / `README.md` / `.gitignore` のみ。以前同梱されていた microCMS の Next.js ブログテンプレート一式は**未使用のため2026-07-25に削除済み**。戻さない。

## 訴求の軸

- **「成果が出なければ、費用は0円」＝ 完全成果報酬型（リスクゼロ）** が信頼の軸。
- **AI × RPO（採用代行）／ AI × スカウト代行**。AI活用で精度高く運用できる、を強調。
  ⚠ **「APO」は誤記。正しくは RPO。**
- スタートアップ導入事例（「何から始めればいいか分からない状態から母集団づくりを支援」）を先頭に。

## 保持している事実情報

- 料金 **20万円/1名**（入社承諾時）
- 返金規定: 入社前100% / 1ヶ月50% / 3ヶ月30% / 6ヶ月10%
- OfferBox統計: 2026卒 230,209人・累計21,089社・開封率82%・承認率15〜20%（※公表値）
- 会社概要: 設立2020/4/1、港区六本木、有料職業紹介 許可番号 **13-ユ-316964**

## デザイン

**白ベース（ダークモード無効）** ＋ネイビー×ティール。トーンは信頼感重視。
緑 `#12A150` は「0円・成果報酬・返金」など**お金／成果のシグナル専用**（green LPのアクセント色とは用途が違う）。ヒーロー／最終CTAはネイビー帯を維持。

## CTA の経緯

かつては Timerex `https://timerex.net/s/r_matsuoka/6666f3b5/` へ直リンクしていたが、**2026-08-11のB2B窓口ルール統一で、ページ内フォーム受け＋サンクス画面に日程調整リンク、に変更済み**。直リンクに戻さない。

---

## 採用企業向け（B2B）LP 共通ルール

このリポジトリは**採用企業向けB2B LP 4本**のひとつ。4本は 2026-08-11 に共通のデザインシステムで作り直した。

| ドメイン | リポジトリ | サービス | アクセント色 |
|---|---|---|---|
| scout.agent-best.net | agentbest/scout | スカウト代行（主要媒体全般） | インディゴ #4C4FD8 |
| green.agent-best.net | agentbest/green | Green運用代行（1面談2万円の面談課金） | グリーン #12A150 |
| infra.agent-best.net | agentbest/infra | Infra 長期インターン採用代理店 | アンバー #C2610C |
| scoutdaikou-offerbox.agent-best.net | agentbest/scoutdaikou_offerbox | OfferBox運用代行 | ティール #0D7E93 |

### 共通の型（新規B2B LPはこれをコピーする）

- `index.html` **1ファイル完結**。CSS・JS・アイコン（インラインSVG）をすべて内包し、**外部CDNを一切読まない**。
- CSS変数トークン（`--paper` / `--ink` / `--accent` / `--navy` 等）＋ **ネイビーのヒーロー＆最終CTA**。アクセント色だけ差し替える。
- `.rv` クラス＋IntersectionObserverでスクロール表示。JS無効時の保険に `<noscript>` で `.rv{opacity:1}`。
- canonical・OGP・favicon（ABマークのSVG data URI）・robots を自ドメインで設定。
- フッターに4本の相互リンク。

### ⚠ 問い合わせ窓口ルール（松岡さんの指示・2026-08-11）

- **CTAから日程調整ツール（Timerex／Calendly）へいきなり遷移させない。** ページ内のお問い合わせフォームで受け、日程調整リンクは**送信後のサンクス画面にだけ**置く。
- フォームはコーポレート `https://www.agent-best.net/contact` と**同一のGoogleフォーム**を使う（フォームID・entry IDは `agentbest/agentbest-lp` の `src/pages/contact.astro` にある）。項目も同じ4つ＝会社名／お名前／メールアドレス／お問い合わせ内容。
- `fetch` の `mode:'no-cors'` で `formResponse` にPOSTし、成功したらサンクス表示に差し替える実装。
- 4LPが同じフォームに入るので、**送信本文の末尾に「お問い合わせ元：〇〇LP」を自動付記**して判別する。新しいB2B LPを作るときも同じ型をコピーし、`SOURCE` 定数だけ変える。
- **求職者向けLPのCTA（Calendly直リンク）とは別ルール。** 混ぜないこと。

### ⚠ Genspark残骸の罠

infra の旧版には Genspark のバッジスクリプト、**他サイトのCloudflare Insightsトークン**、Unsplashホットリンクが埋まっていた（Genspark生成ページの残骸）。同種の生成物を扱うときは同じ混入を必ず疑い、grepで確認する。

## push のルール

- ローカルで動作確認（ブラウザ表示・構文チェック）を済ませた変更は、**確認を取らずに commit & push してよい**。コミットメッセージは日本語。**push後は必ず何を変えたか報告する**（無言でpushしない）。
- **以下に触れるときは必ず止まって事前確認する**:
  1. ドメイン・DNS・CNAME（DNSは**Squarespace Domains**管理・松岡さんの手作業）
  2. 個人情報・フォーム・認証
  3. 費用が発生する変更
  4. 既存ページ・データの削除
  5. 複数リポジトリへの一括変更
- Publicリポジトリ。push前にトークン・APIキーの混入をgrepで確認する。
- `main` への push = **即本番公開**（GitHub Pages）。
