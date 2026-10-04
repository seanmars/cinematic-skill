# Tasks: add-studio-bridge

## 1. Spike: 驗證 mod 的載入與喚醒前提 (design D8)
- [x] 1.1 在 repo 外的暫存目錄和 repo 內的 `playground/` 各建一份 project 層 skill 資料夾,放入最小 mod (`session.start` 寫一個檔案、註冊一個工具、每 2 秒輪詢一個旗標檔、旗標出現時呼叫 `$.prompt.submit`)
- [x] 1.2 回答 Open Questions 1、3、5: 分別在「沒有全域同名 skill」和「`~/.claude/skills/cinematic-video` 存在但沒有 manifest」兩種情況下啟動 Claude Code,記錄 mod 是否載入、是否需要 trust 或同意,以及目前的 Claude Code 版本
- [x] 1.3 回答 Open Question 2: 在 `playground/` 開 Claude Code,記錄哪一個 `.claude/skills` 被當成 project 層;如果不是 playground 的那一份,測試備案 (移到 repo 外,或在 playground 內 `git init`)
- [x] 1.4 回答 Open Question 4: 讓 session 閒置後寫入旗標檔,確認新的一輪會開始;使用者正在 terminal 輸入時重複一次,記錄行為
- [x] 1.5 回答 Open Questions 6、7: 測試 hooks.json 能不能引用 hooks 目錄外的模組,以及 mod 能不能透過 `classic.Notification` 收到 `permission_prompt`
- [x] 1.6 把結果寫進 design.md 的 Open Questions;只要有任何前提不成立,就先更新 design、相關 ADR 和後續 tasks,再繼續做第 2 組

## 2. 開發骨架與 gitignore 陷阱檢查
- [x] 2.1 寫一個會失敗的 vitest: skill 目錄中除了 manifest 和快取以外,沒有任何被 git ignore 的檔案 (不在 git repo 時略過)
- [x] 2.2 建立根目錄 package.json (private)、pnpm workspace 和 `studio/package.json` (engines、vitest);在根目錄 `.gitignore` 加入 `playground/` 和原始碼中的 manifest 路徑;讓 `pnpm test` 執行 vitest,直到測試通過
- [x] 2.3 建立 `schema/` 的 gate、reply、assignment、session schema (D2)

## 3. init 一般模式
- [x] 3.1 寫會失敗的 vitest: 「目標目錄不存在」「目標目錄非空且沒有 force」「Node 版本不足」「沒有安裝 pnpm」「複製時排除快取與依賴」「產生的依賴與 studio 宣告一致」,以及會產生 manifest、workspace 標記、settings 和 gitignore,但不產生 MCP 設定
- [x] 3.2 實作 `studio/init.mjs` 的一般模式 (D6),直到測試通過
- [x] 3.3 寫一個會失敗的 vitest: 「Claude 等待權限授權」(`notify.mjs` 讀取 stdin 後,寫出 permission 檔)
- [x] 3.4 實作 `studio/notify.mjs`,直到測試通過

## 4. init link 模式與 playground
- [x] 4.1 寫會失敗的 vitest: 「修改原始碼後立即生效」(link 指向原始碼)、「manifest 不會被散佈」(manifest 路徑被 git ignore)、link 模式不產生 package.json、`--seed` 會複製 fixture
- [x] 4.2 實作 `--link` (Windows 用 junction,其他平台用 symlink) 與 `--seed` (D7),直到測試通過
- [x] 4.3 把 `video/lunelle-promo` 搬到 `playground/video/`,用 `init --link --seed fixtures/demo` 建立 playground

## 5. gate 來回的最小路徑 (只透過檔案)
- [x] 5.1 設定 mod 測試的骨架 (`claude plugin test`),並納入 `pnpm test`
- [x] 5.2 寫會失敗的 mod 測試: 「一般 gate」「auto-continue 的 gate」「回覆檔出現」「清除暫存資料後重新開啟 session」「讀到寫一半的回覆檔」,以及沒有 workspace 標記時什麼都不註冊
- [x] 5.3 實作 `studio/mod/register.ts`: workspace 標記檢查、`open_gate`、輪詢、`prompt.submit` 之後寫入 `deliveredAt` (D3、D4),直到測試通過
- [x] 5.4 在 playground 用真正的 Claude Code 端對端驗證: Claude 開 gate 並結束這一輪 → 手動寫入 reply 檔 → Claude 在數秒內被喚醒 → `deliveredAt` 已寫入

## 6. 指派與 session 狀態
- [x] 6.1 寫會失敗的 mod 測試: 「同一個 workspace 有兩個 session」「重新指派給新的 session」「session 正常結束」「長時間 render 期間」(心跳由計時器持續寫入)
- [x] 6.2 實作心跳、短 id 與 status line、離線標記、只處理指派給自己的專案、重新指派時的接續喚醒,直到測試通過

## 7. 協定注入、模式偵測與 render 防護
- [x] 7.1 寫會失敗的 mod 測試: 「跳過精修 gate 直接 render」「渲染 stills」、部分時段 render 不被擋、auto-continue 視為已核准、`prompt.compose` 有加入協定段落
- [x] 7.2 實作 `prompt.compose` 的協定段落與 D5 的 deny 判斷,直到測試通過
- [x] 7.3 在 SKILL.md 加入精簡的模式說明
- [x] 7.4 在 playground 驗證「載入 mod 的 session」(Claude 在每個階段都開 gate) 與「全域的舊版 SKILL.md 蓋過副本」

## 8. 端對端驗收
- [x] 8.1 用一般模式 init 一個全新的 workspace,確認「在 workspace 啟動 Claude Code」(mod 載入);在另一個目錄確認「全域安裝的 skill」(mod 不載入)
- [x] 8.2 在新的 workspace 中,用手動寫入的 reply 檔驅動 Claude 走過 Intake、Treatments、分鏡三個 gate
- [x] 8.3 執行 `pnpm test` (vitest、mod 測試、pytest),確認全部通過且沒有略過的測試
