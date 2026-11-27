# GitHub Pages公開・iPhone導入手順

## 1. GitHubリポジトリ作成

1. ローカルで `git status --short --ignored` と `git ls-files` を実行します。`.private/`、バックアップ、`.tools/`、環境変数ファイルが公開対象に含まれていないことを確認してください。公開前は引き続き `git diff --cached` も確認します。
2. GitHubで空の **Public** リポジトリを作ります。たとえば名前は `iron-compass`、既定ブランチは `main` とします。GitHub FreeでPagesを使う場合、リポジトリのソースとサイトが公開されます。公開コミットには設定したGitの著者名・メールも関連するため、用途に応じてGitHubのnoreplyメールを使用してください。
3. ローカルリポジトリが未初期化なら `git init -b main` を実行します。公開を承認した後、公開対象の差分を確認してコミットし、GitHubで表示されたリポジトリURLを `origin` に設定して `main` をpushします。

   ```powershell
   git add .
   git diff --cached --name-only
   git diff --cached
   git commit -m "Prepare IRON COMPASS for GitHub Pages"
   git remote add origin https://github.com/YOUR-ACCOUNT/iron-compass.git
   git push -u origin main
   ```

[GitHub Pagesの利用条件とワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 2. GitHub Pages初回公開

1. GitHubリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
2. **Actions → Build and deploy GitHub Pages → Run workflow** で既定ブランチを指定します。ワークフローは手動起動です。依存関係のインストール、型チェック、テスト、ビルド、配布物検査がすべて通ると `dist/` のデプロイに進みます。
3. デプロイ成功後、Actionsのデプロイ欄に表示されたHTTPS URLを開きます。下部メニューを切り替え、たとえば `/iron-compass/#history` の状態で再読み込みします。URLのパス部分はリポジトリ名・Pages設定に応じて変わります。
4. 同じ公開URLで動作確認後、iPhoneのホーム画面に追加します。最初のアクセスはオンラインで行い、一度再表示してから機内モードで再読み込みを確認します。

[Pagesの公開元を設定する手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

公開前に同じサブディレクトリ設定をローカルで試す場合は、PowerShellで次を実行して `/iron-compass/#history` を開きます。

```powershell
$env:PAGES_BASE_PATH = '/iron-compass'
npm.cmd run build
npm.cmd run verify:dist
npm.cmd run preview
```

通常のローカル用ビルドに戻すときは `Remove-Item Env:PAGES_BASE_PATH` を実行します。

## 3. iPhoneにインストール

1. iPhoneのSafariで公開されたHTTPS URLを開きます。
2. ページメニューまたは共有ボタンから **ホーム画面に追加** を選びます。「Webアプリとして開く」が表示された場合は有効にして **追加** を押します。
3. ホーム画面のIRON COMPASSを開きます。設定に表示されるアプリバージョンを確認します。実績を入力する前に、このホーム画面アプリを移行先として開いてください。

[Appleのホーム画面追加手順](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)

## 4. アプリを更新

- **利用者** — オンラインでアプリを開き直し、更新通知が出たら記録や編集中のフォームを保存します。設定からJSONバックアップを保存して、通知の **更新する** を押してください。下書きや履歴編集中は更新操作が保留されます。更新後は設定でバージョン、履歴で記録を確認します。
- **保守者** — 公開内容を変更するときは `package.json` と `package-lock.json` のアプリバージョンを更新し、検証後に同じ手動ワークフローを実行します。URLやリポジトリ名を変更する前には利用者にバックアップを案内します。

## 5. PCからiPhoneへ個人設定・実績を移行

PC版とiPhone版は自動同期されません。元の初期設定だけを移す場合は、作業フォルダに保存した `.private/personal-settings.json` を使います。既にPCで記録や個別設定を作成している場合は、次節の手順でPC版から最新のバックアップを作成してください。元の初期設定にはPCで後から入力した実績は含まれません。

1. JSONを自分で管理する経路でiPhoneの「ファイル」に移します。アプリから第三者や外部サービスへ自動送信されることはありません。
2. iPhoneのホーム画面アプリを開き、**設定 → バックアップ・データ出力 → JSON 復元ファイル** で選択します。選べない場合は、JSONのテキストを貼り付けて検証できます。
3. ファイル名とセッション数を確認します。復元は端末内の記録・設定・下書き・AI回答をすべて置き換えます。既に利用している端末なら先にバックアップを保存してください。復元後、プロフィール・ジム・履歴を確認します。

## 6. バックアップ

設定の **JSON バックアップ** を押してファイルを作り、**共有・ファイルに保存** から保存先を選びます。共有ボタンが出ない環境では **ダウンロード** を使います。CSVも同じ操作で出力できます。端末移行や復元にはJSONを使用し、公開リポジトリには含めないでください。PCでは非公開フォルダに保管してください。

## 7. トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| URLが404、アイコンが表示されない | PagesのSource、直近のActions結果、Actionsが表示したURLを確認します。公開URLは通常、末尾がリポジトリ名とスラッシュになります。 |
| Offlineで画面が開かない | HTTPSでオンライン起動し、キャッシュが用意されてから再読み込みを試します。プライベートブラウズや通常のLAN上のHTTPでは保存・SWが制限されます。 |
| 更新通知が出ない | オンラインで前面に戻すか再度開き、現在のバージョンを確認します。サイトデータを消す前にJSONを保存します。 |
| コピーできない | プロンプト欄を長押しし、全選択から手動コピーします。 |
| JSONの選択・共有が使えない | ファイルアプリからJSONを選び直すか、復元欄にテキストを貼り付けます。書き出しはダウンロードを試します。 |
| 記録が見えない | 別端末、別ブラウザー、別URL、Safariタブとホーム画面アプリのデータ保存先を確認します。元の保存先でJSONを作成し、使うアプリ側に復元します。 |
