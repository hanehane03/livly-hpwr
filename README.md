# リヴリー HPwr調整

現在のHPwrと確認時刻から満タンになる時刻を計算し、24時に480を確保できる水やり回数を案内する、スマートフォン向けの非公式PWAです。

## 計算条件

- HPwrの上限は480、1分間に1回復、水やり1回で10消費。
- 今すぐ、または同じ日の指定時刻にまとめて水やりする場合に対応。
- 24時に480を確保できる最大回数を提案し、回復の無駄を減らします。
- 回復だけでも24時に480へ届かない場合は0回を提案し、不足を表示します。
- 上限による回復の無駄を、水やり前・水やり後に分けて表示します。
- 秒数、水やり中の経過時間、途中の別操作、日付をまたぐ予約は計算に含めません。
- 入力した確認時刻を基準に計算します。ゲーム内の残量が変わったら、HPwrと時刻を更新してください。

## スマートフォンにインストール

1. 公開されたHTTPSのページを開きます。
2. AndroidのChromeでは「アプリをインストール」ボタン、またはブラウザメニューからインストールします。
3. iPhone・iPadではSafariの共有メニューから「ホーム画面に追加」を選びます。
4. 画面下に「準備完了」と表示されてからは、通信がなくても開いて計算できます。

ブラウザやOSによりメニュー名が異なります。初回の読み込みには通信が必要です。入力値の保存やサーバーへの送信、アクセス解析は行っていません。

## ローカルで確認

Node.js 18以上（CIは22）を使用します。外部npmパッケージのインストールは不要です。

```sh
npm test
npm start
```

`http://127.0.0.1:8000/` を開きます。`index.html` を直接開いて計算することもできますが、PWA機能にはHTTPSまたはlocalhostが必要です。

## GitHub Pages

`.github/workflows/pages.yml` が、`main` へのpush時に次を実行します。

1. 計算・PWA構成・公開ファイルのテスト。
2. `npm run build` で公開対象だけを `dist/` に出力。
3. 公式Pages Actionsでアップロード・デプロイ。

リポジトリの **Settings → Pages → Source** は **GitHub Actions** に設定します。公開URLは通常 `https://<account>.github.io/<repository>/` です。Manifest、アイコン、CSS、JS、Service Workerは相対パスを使い、リポジトリ名のサブパスに対応しています。

Pagesへ配信するのはHTML・CSS・JS・Manifest・アイコンのみです。テスト、開発スクリプト、ローカル設定、Git履歴はPagesの成果物に含めません。公開リポジトリのソースコードや履歴は閲覧可能なので、秘密情報をコミットしないでください。

公開ファイルを変更した場合は `sw.js` の `VERSION` を更新してください。新しい版はアプリ内の更新ボタンで適用できます。更新時に入力内容はリセットされます。

参考：[GitHub Pages公式のカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[PWAのManifest](https://web.dev/articles/add-manifest)。
