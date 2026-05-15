# 画像エディター PWA

ブラウザでアクセスして「アプリとしてインストール」できるPWA（Progressive Web App）です。
インストール後はブラウザを開かずに、独立したアプリのように使えます。

## ファイル構成

```
image_editor/
├── index.html          # 本体（v6のエディタ）
├── manifest.json       # PWAマニフェスト
├── service-worker.js   # オフラインキャッシュ
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-192-maskable.png
```

## 設置方法

### GitHub Pagesに置く場合

既存の `Image_Gen/` リポジトリの直下に `image_editor/` フォルダごとアップロードします。

```
Image_Gen/
├── p_builder/
├── orange-renamer/
└── image_editor/        ← ここに配置
    ├── index.html
    ├── manifest.json
    ├── service-worker.js
    └── icons/
```

アクセスURL:
```
https://orangemark0808-code.github.io/Image_Gen/image_editor/
```

## インストール方法

### PC（Chrome / Edge）

1. 上記URLにアクセス
2. 右上に「📲 アプリとしてインストール」ボタンが表示されるのでクリック
3. 確認ダイアログで「インストール」を選択
4. デスクトップにアイコンが追加され、独立ウィンドウで起動できるようになる

または、アドレスバーの右端に表示される「インストール」アイコン（⊕やモニターの形）からでもインストール可能です。

### Mac（Chrome / Edge / Safari 17+）

PCと同様。Safari 17以降の場合は「ファイル」メニュー → 「Dockに追加」または「ホーム画面に追加」。

### iPhone / iPad（Safari）

1. SafariでURLにアクセス
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」を選択
4. ホーム画面にアイコンが追加される

### Android（Chrome）

1. ChromeでURLにアクセス
2. メニュー（⋮）→「アプリをインストール」または「ホーム画面に追加」
3. ホーム画面にアイコンが追加される

## 特徴

- **オフライン動作**: 一度インストールすればネット接続なしで使える
- **独立ウィンドウ**: ブラウザのタブやアドレスバーなしで起動
- **自動更新**: index.html を更新→ service-worker.jsの `CACHE_VERSION` を上げると、次回起動時に「新しいバージョンが利用可能」と通知

## 更新方法

1. `index.html` などのファイルを編集
2. `service-worker.js` の `CACHE_VERSION` を変更（例: `v6.0.0` → `v6.0.1`）
3. GitHub Pagesにpush
4. インストール済みユーザーの次回起動時に自動更新

## アンインストール

### PC（Chrome / Edge）
- アプリウィンドウの右上「⋮」→「アンインストール」
- または `chrome://apps/` から削除

### スマホ
- 通常のアプリと同様、ホーム画面でアイコン長押し→削除

## 注意事項

- PWAインストール機能は **HTTPS** または **localhost** でのみ動作します。GitHub Pagesは自動でHTTPS化されているため問題ありません。
- Firefoxの場合、PWAインストールボタンは表示されません（Firefoxは現在デスクトップPWA非対応のため）。ブラウザでそのまま使うか、別ブラウザを使ってください。
