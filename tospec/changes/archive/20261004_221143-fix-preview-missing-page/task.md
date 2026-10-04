# Task: fix-preview-missing-page

## Feedback Loop
```bash
uv run tospec/changes/fix-preview-missing-page/probe.py
```
這個 probe 會建立一個暫存 workspace:demo 專案有 storyboard.json,但沒有 index.html.接著用 `start.mjs` 啟動 studio,再用 headless 瀏覽器 (zh-TW) 開啟網頁,檢查兩個時間點的預覽狀態:

- 沒有 index.html 時
- 寫入 index.html 之後

只要有一項不符合預期,就以 exit code 1 (RED) 結束.修正前的輸出:

```
without index.html: {'loading': True, 'timeout': False, 'missing': False, 'iframe': True}
after index.html appears: {'loading': False, 'timeout': False, 'missing': False, 'iframe': True}
RED
```

GREEN 的條件:沒有 index.html 時只顯示「還沒有畫面」的提示,不掛 iframe,也沒有載入中或 timeout 的訊息;寫入 index.html 之後,不需要重新整理網頁就換成頁面預覽.

## Root Cause
**症狀**:Claude 寫出 storyboard.json 之後,預覽一直顯示「正在載入預覽…」,60 秒後顯示「頁面一直沒有準備好: 找不到 window.render, 或 window.ready 始終是 false.」.

**時間點**:這段期間是從 Treatments 回覆之後開始的.這時最新的 gate 還是 002-treatments,所以畫面仍然是 Treatments 面板.問題會一直持續到 Build 寫出 index.html,Storyboard gate 期間也會發生.以使用者的 `promo-video` 為例:

| 時間 | 事件 |
|---|---|
| 19:59 | 回覆 Treatments |
| 20:07 | 出現 brief.md (表示已經有 storyboard.json) |
| 20:14 | 開啟 storyboard gate |
| 20:26 | 才出現 index.html |

**原因**:預覽沒有「頁面還不存在」這個狀態.
- `app/components/project-view.tsx` 只要 `project.storyboard !== null` 就顯示 `PreviewPanel`.
- `app/components/preview.tsx` 一律把 `${previewBase}index.html` 掛進 iframe.
- index.html 要到 Build 才會寫出.在那之前,`server/preview.mjs` 對它回 404 純文字 `Not found`.
- iframe 載入 404 頁面時照樣觸發 `onLoad`,`untilReady` 會等 60 秒找 `window.render`,最後顯示 `preview.timeout`.

所以這個錯誤訊息是誤導:頁面不是壞了,而是還沒寫出來.

**假設與驗證** (依可能性排序):
1. **預覽不管頁面存不存在都會掛 iframe,404 頁面被當成「一直沒準備好」(已確認)**.
   - 預測:index.html 出現後,預覽不需要其他改動就會恢復正常.
   - 驗證:
     - 用暫存 workspace 啟動 studio:API 回傳 `storyboard` 不是 null、`previewBase` 是 `/__video/demo/`,`GET /__video/demo/index.html` 回 404 `"Not found"`.
     - probe 寫入 index.html 之後,`loading` 從 True 變成 False,iframe 正常.
2. **Claude 在這個階段寫出的 index.html 本身沒有 `window.render`,或者一直沒把 `window.ready` 設成 true (否定)**.
   - `promo-video` 的 index.html 是 20:26 (Build) 才建立的,而且有 `window.render`,字型載入後會設定 `window.ready = true`.
   - probe 在完全沒有 index.html 的情況下就能重現症狀.
3. **`previewBase` 或 `renderRoot` 指錯位置,導致存在的頁面也回 404 (否定)**.
   - `previewBase` 正確,而且 index.html 出現後預覽就能正常顯示.

## Fix Plan
在 `Preview` 元件裡,先確認頁面存在,再掛上 iframe:

- 每次要載入時,先對 `src` 發 `HEAD` 請求 (`cache: 'no-store'`).
  - 回 404 → 新增的 `missing` 狀態:在預覽的位置顯示 `preview.missing` 提示,不掛 iframe.
  - 其他回應 (包括請求失敗) → 照原本的流程掛 iframe,真正有問題的頁面仍然會顯示原本的錯誤.
- 收到 `studio:preview` 推送時 (目前的 `reloads` 計數),重新檢查一次.index.html 第一次寫出時,watcher 推送的正是 `studio:preview`,所以頁面一出現,預覽就會自動切換,不需要修改 API 或推送機制.
- 時間軸和播放頭不受影響,Storyboard gate 仍然可以照常編輯鏡頭.
- 新增 `preview.missing` 字串到 zh-TW 與 en locale.

**為什麼這是根本的修正**:
- 問題在於預覽把「頁面不存在」和「頁面沒準備好」混為一談,所以要在預覽決定是否載入頁面的地方區分這兩種狀態.
- 如果只是拉長 timeout,或者在 Build 之前隱藏整個預覽面板,都只是掩蓋症狀.而且後者還會依賴 gate 階段推測檔案是否存在;Claude 可能提早或延後寫出頁面,這個推測不可靠.

**Archive 順序**:studio-web 的 main spec 由 add-web-studio 建立.這個 change 應該在 add-web-studio 之後 archive;到時候 main spec 已經存在,要先刪掉 delta 裡的 `## Purpose`.

## Test Plan
- **為什麼現有測試沒有抓到**:
  - add-web-studio 的 design 把前端元件測試與 UI e2e 列為 Non-Goal,`preview.test.mjs` 只測 server 端的靜態 middleware (MIME、Range、缺檔 404),沒有測預覽元件怎麼處理 404.
  - `fixtures/demo` 一直都有 index.html,所以用 fixture 開發或手動檢查時,永遠不會進入「頁面還沒寫出」的狀態.
  - 手動測試文件第 6 節只寫了「如果 Claude 已經寫了 index.html」,沒有描述沒有頁面時應該看到什麼.
- **要加的測試與 edge case**:
  - (a) `preview.test.mjs`:對還沒寫出的頁面發 `HEAD`,回應 404;頁面寫出後回應 200.這是修正依賴的契約 → 1.2
  - (b) probe:沒有頁面時顯示提示且不掛 iframe;頁面出現後不必重新整理就切換成預覽 → 1.1 (RED)、1.4 (GREEN).依照 add-web-studio 的 Non-Goal,不加進 `pnpm test`,保留在這個 change 裡當作 feedback loop.
  - (c) zh-TW 與 en 的 locale key 一致:由現有的 `locale.test.mjs` 涵蓋,新增字串後在 1.5 跑完整測試時確認,不需要另外的 task.
  - (d) 頁面存在但真的沒有 `window.render`:仍然要顯示 timeout 錯誤.probe 的第二段 (頁面存在時 `timeout` 為 False) 只能確認沒有誤報;真的壞掉的頁面沿用原本的流程,不改動,所以不另外加測試.

## Tasks
### 1. Fix
- [x] 1.1 執行 probe,確認是 RED (`loading: True`、`iframe: True`、`missing: False`)
- [x] 1.2 在 `test/preview.test.mjs` 加入 vitest:對還沒寫出的頁面發 `HEAD` 回應 404,寫出後回應 200
- [x] 1.3 在 `app/components/preview.tsx` 加入 `HEAD` 檢查與 `missing` 狀態,收到 `studio:preview` 時重新檢查;在 `app/locale/zh-tw.ts` 與 `app/locale/en.ts` 加入 `preview.missing`
- [x] 1.4 執行 probe,確認是 GREEN
- [x] 1.5 執行 `pnpm test` (vitest、mod 測試、pytest),確認全部通過,而且沒有略過的測試
- [x] 1.6 更新 `docs/web-studio-manual-test.md` 第 6 節:還沒有 index.html 時,預覽的位置顯示「還沒有畫面」的提示
