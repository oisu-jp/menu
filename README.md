# 1週間の献立メモ PWA（Google Calendar API + 祝日API版）

## 変更内容
- 祝日判定をローカル計算からAPI取得に変更
- Vercel Serverless Function `api/holidays.js` を追加
- まず Google Calendar API を呼び、失敗時は `holidays-jp` の祝日APIにフォールバック
- 今日の行を強調表示
- 買い物リストのチェック・並び替えは継続

## Vercel で必要な設定
### 推奨
Project Settings → Environment Variables に追加
- `GOOGLE_CALENDAR_API_KEY`

APIキー未設定でも、祝日APIフォールバックで祝日表示は動きます。

## Google Cloud 側
1. Google Cloud でプロジェクト作成
2. Google Calendar API を有効化
3. Credentials で API Key を作成
4. 可能なら HTTP referrer で自分の Vercel ドメインに制限

## デプロイ後の確認
- 画面上部のバッジが `祝日: Google Calendar API` なら Google 側で取得成功
- `祝日: 祝日API` ならフォールバックで取得成功
