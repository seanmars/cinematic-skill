## Why

add-studio-bridge 打通了「Claude 停在 gate → 回覆檔 → 喚醒」的檔案路徑,但使用者還是只能手動寫檔.本 change 加上網頁 studio,讓使用者在瀏覽器中看到每個階段的方案、每顆鏡頭的情境、技巧與素材、音效和即時進度,並在 gate 上直接編輯、選擇方案、調整時長,再決定繼續或重做.這就是最初提出的需求: 用網頁互動完成整支影片.依據 ADR: web-mode-stage-gates、web-gate-payloads、studio-state-file-layout、studio-preview-static-serving、storyboard-schema-technique-slots、studio-live-progress、studio-ui-layout、timeline-duration-ripple、studio-init-dev-loop、v1-testing-strategy、studio-lifecycle-slash-command.依賴 add-production-data 與 add-studio-bridge.

原本要開兩個 terminal、依序執行 `pnpm dev` 與 `claude` 才能使用 studio,結束時也要分別關閉;本 change 一併改成在 Claude Code 中以 `/studio` 指令啟動與停止,最後一個 session 離開時自動停止.

## What Changes

- **新增 studio server**: 以 Vite dev server 作為 runtime,只綁 localhost,所有寫入請求都經過 mutation guard.提供專案列表、gate 與回覆、Intake、指派與重新指派、手動解鎖、storyboard 欄位更新、時長順延、技巧索引、session 與進度狀態等 API,並透過 WS 推送檔案變動.
- **新增預覽**: 用不經轉換的純靜態方式提供專案頁面 (root 與 MIME 跟 render 腳本相同,支援 Range),iframe 等頁面載入完成後才呼叫 `render(t)`,檔案變動時 debounce 重載.
- **新增網頁 UI**: React、Tailwind、shadcn/ui,深色中性主題,繁中與英文 locale.版面採用剪輯軟體式: 左側專案與階段,中間預覽與時間軸 (鏡頭依時長排列,SFX 畫成音軌),右側 inspector.中間區域依 gate 切換為 Intake 表單、方案卡、critic 報告等內容.
- **新增 gate 時的編輯**: 四個主技巧欄位單選、其他類別多選標籤 (來自技巧庫索引與專案自訂技巧),以及自由文字與意見;修改時長時自動順延後續鏡頭,並平移 audio plan 中後續的 cue,被改鏡頭內的 cue 與配樂則標記交給 Claude.每次回覆都附上改動清單.
- **新增即時進度**: mod 記錄每個工具呼叫的活動;render 腳本新增進度檔參數;web 模式下 Claude 會寫入 Build 進度檔;網頁顯示活動、render 進度條、離線與等待授權提示.
- **新增其餘 gate 面板與 auto-continue 設定**;studio 發現產出超過已核准的階段時,顯示跳過 gate 的警告.
- **修改 mod 協定**: 補上各階段 gate payload 的產出規則、Build 進度檔與 render 進度參數.
- **新增 studio 生命週期管理**: mod 註冊 `/studio start|stop [--force]|status`.start 在背景啟動 studio (一般模式缺少依賴時先自動安裝,已經在執行就沿用),並開啟瀏覽器;stop 在還有其他線上 session 時需要 force;最後一個線上 session 離開時自動停止;status line 顯示 studio 網址,開 gate 時 studio 沒在執行就提醒使用者.
- **移除 `pnpm dev`**: workspace 不再有 dev script,也拿掉 repo 根目錄的 dev 指令;init 的下一步指示改成在該目錄開啟 Claude Code 後執行 `/studio start`.
- **修改 README 與手動測試文件**: 加入 web 模式的需求、init 用法與本 repo 的開發方式,啟動與結束步驟改用 `/studio`.

## Capabilities

### New Capabilities
- `studio-web`: 網頁 studio (網路防護、專案列表、從網頁開始 Intake、各 gate 的顯示與回覆、gate 時的編輯、時長順延、預覽、即時進度與 session 狀態、介面語言、studio 的啟動與停止) (maps to specs/studio-web/spec.md)

### Modified Capabilities
- `studio-workspace`: init 的下一步指示改成開啟 Claude Code 後執行 `/studio start`,workspace 的 package.json 不再包含 dev 指令 (maps to specs/studio-workspace/spec.md)
- studio-bridge 由 add-studio-bridge 新增,本 change 只擴充它的協定內容、活動紀錄與 `/studio` 指令,行為規格寫在 studio-web

## Impact

- **skill**: studio 新增 `app` (前端) 與 `server` (Vite plugin) 目錄,以及 server 入口與 launcher;mod 新增活動紀錄、協定內容、`/studio` 指令與 session 結束時的停止邏輯;init 不再產生 dev script,下一步指示改寫;render.py 新增進度檔參數;studio 依賴新增 Vite、React、Tailwind、shadcn/ui 相關套件和 sirv.
- **本 repo**: 拿掉根目錄的 dev 指令,playground 改用 `/studio start` 啟動;README 與 `docs/web-studio-manual-test.md` 更新.
- **使用者專案**: `audio/plan.json` 與 storyboard.json 在 gate 時可能被網頁修改 (依 gate 狀態錯開寫入時間).
- **安全**: 寫入狀態檔等於可以觸發 Claude 執行 prompt,所以只綁 localhost,並沿用 open-slide 的 mutation request guard.
