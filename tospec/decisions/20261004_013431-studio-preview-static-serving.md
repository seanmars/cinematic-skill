# render(t) 預覽以純靜態提供, 對齊 render.py 環境

## Status

- proposed
- Date: 20261004_013431

## Context

v1 要在網頁上用 `render(t)` 拖曳時間軸即時預覽 (見 `20261004_005439-web-mode-stage-gates.md`).預覽頁面就是 `video/<slug>/index.html`,而它真正被 render 的環境是 `render.py`:

- 用純靜態的 `http.server` 提供頁面,沒有任何轉換,root 是頁面所在目錄 (或 `--root`),並明確指定 `.js`、`.mjs`、`.json`、`.wasm`、`.svg` 的 MIME (Windows registry 可能把 `.js` 對應成 text/plain) (`render.py:29-31, 52-63`).
- `window.render(t)` 可以回傳 Promise;頁面可以用 `window.ready` 表示載入完成 (`render.py:6-11`).
- 範例專案會在 `document.fonts.ready` 之後才設定 `window.ready = true` (`lunelle-promo/index.html:631`).

studio 本身是 Vite dev server.如果讓 Vite 提供專案頁面,它會改寫 HTML (注入 `/@vite/client`、分析 module script),使用 import map 或 CDN module 的頁面可能會壞,預覽結果也會跟 render 不一致.

## Decision

- studio 以**純靜態方式**提供專案頁面,不經過 Vite 的 HTML 轉換.MIME 設定跟 render.py 相同,root 規則也跟 render.py 相同: 預設是專案目錄,也支援專案宣告的 root.
- 預覽用 iframe 以原生解析度 (例如 1920×1080 或 1080×1920) 載入,再用 CSS 縮放.因為同源,父頁面等 `window.ready` 之後才呼叫 `iframe.contentWindow.render(t)`,並 await 它的 Promise.
- studio watch 專案檔案,有變動時 debounce 後用自訂 WS 事件通知網頁重載 iframe.
- 只提供讀取 (GET),路徑必須限制在 `video/` 底下,防止 path traversal.

選擇理由: 預覽跟 render 的環境一致,才不會出現「預覽正常但 render 壞掉」或反過來的情況.Non-negotiable #2 (畫面是時間的純函數) 也保證任意 seek 都正確.

## Impact

- studio 新增靜態檔案 middleware (要掛在 Vite 的 HTML middleware 之前)、iframe 預覽元件,以及專案檔案的 watch 與重載事件.
- storyboard.json 可能需要一個「預覽/render root」欄位.

## Alternatives

- **交給 Vite 提供**: 自動有 HMR,但會注入 client 並轉換 module script,可能弄壞頁面,也跟 render 的結果不一致.不採用.
- **一律以 `video/` 當 root**: 共用資源 (例如 `../fonts`) 比較方便,但在預覽能動的頁面,用 render.py 預設 root 時可能會壞.不採用,改成跟 render.py 相同的規則.

## Follow-up

1. 實作靜態 middleware (MIME、root、path traversal 防護).
2. 實作 iframe 預覽 (縮放、`window.ready`、await `render(t)`).
3. 實作時確認: Vite 對 studio root 以外的 `.html` 變動,會不會觸發 studio 頁面 full-reload.
4. 決定 storyboard.json 裡 root 欄位的名稱和預設值.

## Related Changes

## Decision Process

**Q:** `render(t)` 的時間軸預覽要怎麼提供頁面?

`video/` 純靜態提供,檔案變動時 debounce 重載.

**Q:** (重述確認) 預覽的 root 規則跟 render.py 相同是否正確?

正確.
