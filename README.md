# ベンゼンノート

芳香族化合物の反応を、スマートフォンで書いて覚える学習アプリです。

**公開サイト：<https://yotamaaikich.github.io/benzene-note/>**

## 使い方

1. 問題と反応条件を読み、生成物の構造式を指・スタイラス・マウスで書きます。
2. 必要なら「ベンゼン環を置く」で環を挿入し、置換基を書き足します。消しゴム・戻す・全消去も使えます。
3. 名前を入力して「答え合わせ」。構造式はお手本と見比べて確認します。
4. わからないときは「スキップ」を1回押すと構造式、もう1回押すと名前が表示されます。スキップで次の問題には移動しません。
5. 名前まで表示した後に、構造式の理由と名前の由来・覚え方が下に表示されます。

資料「THE・ベンゼン」の反応経路をもとにした49問・40化合物を収録。資料の写真は公開していません。構造式・説明文は新たに作成しています。省略されていた反応条件を補い、異性体や生成物の段階を問題文で指定しています。

手書き構造式の自動認識・採点は行いません。名前は慣用名・別名を許容して照合します。スキップや誤答のあった問題を「復習する」から再学習できます。

## スマートフォン

- 320px幅からの縦画面に対応。描画中はキャンバス内のスクロールを抑止します。
- ホーム画面に追加して単独のアプリ画面として使えます。iPhoneではSafariの共有メニュー、Androidでは対応ブラウザのメニューを使います。
- 初回にオンラインでページと各機能を読み込むと、Service Workerによるキャッシュ後はオフラインでも学習できます。
- 手書き・途中の問題・ヒントの段階・学習記録はブラウザのlocalStorageへ保存します。サーバーへの送信や端末間の同期はありません。

## 開発

Node.js 22以降。外部パッケージは不要です。

```sh
npm start
npm test
```

ローカルURLは <http://127.0.0.1:4173>。ビルド不要のHTML/CSS/ES Modulesで、GitHub Pagesの `main` ブランチ `/` から配信します。

- `data.js`：問題と化合物データ
- `molecules.js`：構造式のSVG描画
- `origins.js`：名称の解説
- `logic.js`：名前の照合と段階表示のロジック
- `app.js`：描画・学習フロー・保存
- `sw.js`：オフラインキャッシュ

## 参考

提供資料を出発点に、条件と説明の一部を以下で照合しました。

- [OpenStax Organic Chemistry 16.8 — Oxidation of Aromatic Compounds](https://openstax.org/books/organic-chemistry/pages/16-8-oxidation-of-aromatic-compounds)
- [OpenStax Organic Chemistry 24.8 — Reactions of Arylamines](https://openstax.org/books/organic-chemistry/pages/24-8-reactions-of-arylamines)
- [IUPAC Gold Book — phenols](https://goldbook.iupac.org/terms/view/P04539)
- [ACS Molecule of the Week — Toluene](https://www.acs.org/molecule-of-the-week/archive/t/toluene.html)
- [ACS Molecule of the Week — Salicylic acid](https://www.acs.org/molecule-of-the-week/archive/s/salicylic-acid.html)
- [ACS Molecule of the Week — Benzoic acid](https://www.acs.org/molecule-of-the-week/archive/b/benzoic-acid.html)

一般的な学習のために反応を整理しています。実験の実施手順を提供するアプリではありません。
