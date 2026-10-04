# Tasks: add-web-studio

## 1. studio server 骨架與 gate 核准的最小路徑
- [x] 1.1 寫會失敗的 vitest: 「其他網站對 studio 送出寫入請求」、「剛從網頁送出 Intake 的專案」「舊專案」(專案列表)、寫入 reply 時會驗證 gate 狀態與 decision
- [x] 1.2 在 `studio/package.json` 加入 Vite、React、Tailwind、shadcn/ui 相關套件與 sirv;實作 `dev.mjs`、request guard (D2)、專案列表與 gate/reply API (D3)、watcher 推送與 recent-writes 抑制 (D4),直到測試通過
- [x] 1.3 實作最小 UI: 版面骨架、深色主題 tokens、locale 基礎 (zh-TW、en)、專案列表、gate 面板上的「核准」按鈕;根目錄 `pnpm dev` 改成以 playground 啟動
- [ ] 1.4 在 playground 用真正的 Claude Code 端對端驗證: Claude 開 gate → 網頁核准 → Claude 在數秒內被喚醒

## 2. Intake、指派與 session 狀態
- [x] 2.1 寫會失敗的 vitest: 「只有一個線上 session」「沒有線上 session」、多個 session 時要求選擇、重新指派與手動解鎖會寫入 assignment、session 與 permission 狀態 API (server 的 1 秒輪詢推送)
- [x] 2.2 實作 Intake API (slug 規則、intake.json)、指派與重新指派、手動解鎖、session 與 permission 的輪詢推送,直到測試通過
- [x] 2.3 實作 UI: Intake 表單 (文字與本機路徑)、session 選擇、短 id 與狀態顯示、離線與等待授權提示、重新指派與解鎖的操作
- [x] 2.4 對照 spec 驗證「Claude 等待授權」「持有者離線」
- [x] 2.5 寫會失敗的 mod 測試並實作: mod 接手 reason 為 intake、還沒有 gate 的專案時,喚醒 Claude 讀取 `studio/intake.json` 開始 Intake (D9),並更新協定中 `[studio project <slug>]` 的說明

## 3. 即時進度
- [x] 3.1 寫會失敗的 pytest: render.py 帶 `--progress-file` 時,進度檔包含幀數、ETA 與 done;不帶參數時行為不變 (「CLI 模式的 render」)
- [x] 3.2 寫會失敗的 mod 測試: 「Claude 派出 critic」(活動紀錄寫入 start、end 和摘要,最多保留 50 筆)
- [x] 3.3 實作 render.py 的 `--progress-file` 與 mod 的活動紀錄 (D8),直到測試通過
- [x] 3.4 寫會失敗的 vitest: render 進度與 progress.json 的讀取 API,以及推送事件;session 在 permission 紀錄之後有新的活動時,不再顯示為等待授權
- [x] 3.5 實作 API、UI 的活動面板、render 進度條、Build 時每顆鏡頭的狀態與 stills;在 mod 協定中加入 progress.json 與 `--progress-file` 的規則 (D9)
- [ ] 3.6 在 playground 驗證「render 進度」「一顆鏡頭完成」

## 4. render(t) 預覽
- [x] 4.1 寫會失敗的 vitest: 「使用 module script 的頁面」(頁面不被轉換)、MIME 跟 render.py 相同、「播放成片」(Range)、擋下跳出 root 的路徑、使用 `renderRoot`
- [x] 4.2 實作 `/__video/<slug>/` 的靜態 middleware,註冊在 Vite HTML middleware 之前 (D5),直到測試通過
- [x] 4.3 實作 iframe 預覽 (原生解析度加縮放、等待 `window.ready`、await `render(t)`)、播放頭、預覽重載的 debounce
- [x] 4.4 確認 Vite 對 root 以外 `.html` 的變動不會讓 studio 頁面 full-reload;用 fixture 驗證「拖曳時間軸」(和 render.py 在同一時間的 still 一致)

## 5. 分鏡 gate 的編輯
- [x] 5.1 寫會失敗的 vitest: INDEX.md 解析 (類別、名稱、路徑、摘要,鎖住目前的格式)、「專案有自訂技巧」(掃描專案 `techniques/`,標示為自訂)、「Claude 工作中」不能寫入 storyboard、「更換運鏡」會寫入欄位並產生改動清單
- [x] 5.2 實作技巧索引 API (D7,包含專案自訂技巧) 與 storyboard 欄位更新 API (只在 gate 開啟時允許),直到測試通過
- [x] 5.3 實作 UI: 時間軸 (鏡頭依時長排列、SFX 音軌)、inspector (自由文字、四個主技巧欄位單選、其他類別多選、技巧說明檢視)、每顆鏡頭的意見、送出時附上改動清單
- [ ] 5.4 在 mod 協定中加入收到改動清單後的同步規則 (D9),並在 playground 驗證「更換運鏡」的端對端行為

## 6. 時長順延與 plan 平移
- [x] 6.1 寫會失敗的 ripple 單元測試: 「拉長中間的一顆鏡頭」「剛好落在鏡頭起點的 cue」、縮短時長、最後一顆鏡頭、沒有 plan、有配樂時加上 `music-recut`、plan 中除了時間以外的欄位都保持不變
- [x] 6.2 實作 ripple 純函式與 API (D6),直到測試通過
- [x] 6.3 實作 UI: inspector 的時長輸入,以及需要重新對齊的 cue 和配樂重剪提示
- [ ] 6.4 在 playground 驗證: Claude 收到改動清單後,會重新對齊 cue、重剪配樂,並更新程式碼中的時間點

## 7. 其餘 gate 面板、auto-continue 與跳過 gate 的警告
- [x] 7.1 寫會失敗的 vitest: 各階段 reply 的 decision 與選填 `choice` 的驗證 (pick、mix、redo、another-round、ship 等)、mod 喚醒訊息帶出 choice 的 mod 測試、「Treatments 混搭」「Gauntlet 再一輪」「v1 不能回到前面的階段」「對 Audio gate 開啟 auto-continue」「分鏡還沒核准就出現 Build 產出」
- [x] 7.2 實作各階段的 decision 與 `choice` 驗證 (reply.schema 加上 choice,mod 喚醒訊息帶出 choice)、settings API 與跳過 gate 的偵測 (D10),直到測試通過
- [x] 7.3 實作 UI: Treatments 方案卡 (選一、混搭、全部重做)、Assets、Build animatic、Build 精修、Audio (混音播放與 cue)、Gauntlet (報告、量測、再一輪或交片)、Deliver,以及每個 gate 的 auto-continue 開關
- [ ] 7.4 在 mod 協定中加入各階段 gate payload 的產出規則 (D9),並在 playground 驗證每一種 gate 都會出現對應的面板

## 8. 介面語言
- [x] 8.1 寫會失敗的 vitest: zh-TW 和 en 的 locale key 完全一致,UI 原始碼中沒有寫死的介面字串
- [x] 8.2 補齊兩個語言的字串與切換功能,直到測試通過;驗證「切換語言」

## 9. 文件與端對端驗收
- [x] 9.1 更新 README: web 模式的需求 (Node、pnpm、支援 mod 的 Claude Code)、init 用法、本 repo 的開發方式
- [ ] 9.2 用一般模式 init 一個全新的 workspace,用真正的 Claude Code 從網頁 Intake 一路做到 Deliver,每一種 gate 至少操作一次
- [x] 9.3 執行 `pnpm test` (vitest、mod 測試、pytest),確認全部通過,而且沒有略過的測試
