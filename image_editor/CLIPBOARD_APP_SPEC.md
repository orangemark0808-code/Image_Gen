# クリップボード履歴アプリ → 画像エディター連携 仕様メモ

## 目的
履歴の画像を右クリック →「画像エディターで開く」の1操作で、
Team. Ohana Studio の「画像editer」タブに画像を読み込ませる。

## 仕組み（Web 側は実装・動作確認済み）
Studio は PNG / JPEG / WebP の `file_handlers` を登録済み。
履歴アプリが「画像ファイルを Studio で開く」と OS に頼めば、
Studio が画像editerタブへ切り替えて読み込む（Finder の「このアプリケーションで開く」と同じ経路）。
編集中の内容がある場合は、置き換え確認ダイアログが出る。

## 履歴アプリ側の実装要件
1. 右クリックメニューに「画像エディターで開く」を追加（画像項目のみ表示）。
2. 画像を一時ファイルに書き出す。
   - 形式は PNG に統一（TIFF / HEIC などは PNG に変換）。
   - 保存先: `NSTemporaryDirectory()` 配下、例 `clip-<UUID>.png`。
   - 起動後すぐ消すと読み込み前に失われる恐れがあるため、アプリ終了時、または 1 時間以上経った分をまとめて削除する。
3. Studio をそのファイルで開く。

```swift
let appURL = URL(fileURLWithPath: NSHomeDirectory())
    .appendingPathComponent("Applications/Chrome Apps.localized/Team. Ohana Studio.app")
let config = NSWorkspace.OpenConfiguration()
config.activates = true   // Studio を前面に出す
NSWorkspace.shared.open([fileURL], withApplicationAt: appURL, configuration: config) { _, error in
    // error があれば通知（下記「失敗時」）
}
```

シェルでの同等コマンド（動作確認用）:
```bash
open -a "$HOME/Applications/Chrome Apps.localized/Team. Ohana Studio.app" /tmp/clip.png
```

## アプリの場所
- 標準は上記パス（Chrome がインストールした PWA の置き場）。
- 無ければ、設定画面で一度だけ .app を選ばせ、パスを保存して使う。
- 将来の保険として、`mdfind "kMDItemFSName == 'Team. Ohana Studio.app'"` で探す方法も使える。

## 失敗時の動作
- Studio が見つからない／開けない場合は、通知を出し、画像を OS クリップボードに戻す。
  その場合の手順はユーザーが「Studio に切り替える → 上部のバナー［読み込む］」。

## 補足
- 画像をクリップボードに入れて Studio に切り替えるだけでも、バナーが出て読み込める（ファイル書き出し不要の簡易版）。
- 渡せるのは 1 枚。複数枚を同時に渡しても、最初の 1 枚のみ読み込まれる。
- Studio 側で画像を読み込むと、画像editerタブに自動で切り替わる。

## 動作確認チェックリスト
- [ ] Studio 未起動の状態で実行 → 起動し、画像が読み込まれる
- [ ] Studio 起動中で実行 → 既存ウィンドウに画像が入る（新しいウィンドウが増えない）
- [ ] 編集中に実行 → 置き換え確認が出る
- [ ] HEIC / TIFF の履歴項目 → PNG に変換されて開ける
- [ ] Studio が見つからない → 通知 + クリップボードへ戻る
