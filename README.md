# OfferBox運用代行 LP（scoutdaikou_offerbox）

株式会社エージェントベストの「OfferBox運用代行｜完全成果報酬型」サービスLP。

- 公開URL: https://scoutdaikou-offerbox.agent-best.net/
- 配信: GitHub Pages（main / ルート）。実体は自己完結の静的 `index.html` 1枚（外部CDN・ローカル資産に非依存）。

## お問い合わせフォーム

コーポレートサイト（https://www.agent-best.net/contact ）と**同一のGoogleフォーム**へ送信しています。
項目は 会社名／お名前／メールアドレス／お問い合わせ内容 の4つで、送信本文の末尾に
「お問い合わせ元：OfferBox運用代行LP」を自動付記して、どのLP経由かを判別できるようにしています。

日程調整ツール（Timerex: https://timerex.net/s/r_matsuoka/6666f3b5/ ）へは、
フォーム送信後のサンクス画面からのみ案内しています（いきなり遷移させない方針）。

更新は `index.html` を編集して push すれば自動反映されます。

## メディア「地方採用ラボ」（/media/）

地方の中小・中堅企業の採用担当者向けの新卒採用ノウハウメディア。記事2,000本。
LPと同じドメイン配下に置き、記事から運用代行の相談導線（`/#entry`）へ送っています。

- 公開URL: https://scoutdaikou-offerbox.agent-best.net/media/
- カテゴリ: エリア（47都道府県）／業種（22）／採用の課題（32）／ダイレクトリクルーティング・OfferBox（16）／地方採用のテーマ（14）＝ 131カテゴリ

### ⚠ `media/` は生成物です。直接編集しないでください

編集するのは `tools/media/` 配下の定義ファイルです。

```bash
node tools/media/generate.mjs   # media/ ＋ sitemap.xml ＋ robots.txt を再生成（数秒）
python3 -m http.server 8000     # ローカル確認（file:// だと絶対パスのCSSが読めません）
```

生成器は毎回、記事本数・slug重複・タイトル重複・本文の完全一致・平均文字数を自己点検として出力します。
重複が出た場合は終了コード1で止まります。

ファイルの役割、カテゴリの増やし方、本文に書いてよいこと／書かないことは `CLAUDE.md` にまとめてあります。

### Search Console

`sitemap.xml`（約2,140URL）を登録してください。`robots.txt` から参照しています。
