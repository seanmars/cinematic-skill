# Design: add-web-studio

## Context

- 前提: add-production-data 提供 `schema/`、storyboard 與 treatments 格式、`fixtures/demo/`;add-studio-bridge 提供 `studio/` (init、notify、mod)、狀態檔契約 (gate、reply、assignment、session)、pnpm workspace、vitest、mod 測試與 playground.
- render.py 用純靜態的 `http.server` 提供頁面,root 是頁面所在目錄或 `--root`,並明確指定 `.js`/`.mjs`/`.json`/`.wasm`/`.svg` 的 MIME.它會等 `window.render` 存在,且 `window.ready` 不是 false 之後才開始;`render(t)` 可以回傳 Promise.目前每 10% 印一次進度到 stdout.
- 技巧庫 `references/techniques/INDEX.md` 依類別分成 `## <Category> (<n>)` 區塊,每一列是 `| [Name](<category>/<slug>.md) | Summary |`.
- `audio/plan.json` 是位置固定的陣列 `[name, time_s, target_dB, note, floor?, cap?]`,`audio_tools.py` 依照這個格式解析.
- 參考實作 open-slide 的做法:
  - Vite dev server 本身就是 runtime (用 `configureServer` 掛 API 和 watcher,`server.watcher.add` 加入額外的路徑).
  - `validateMutationRequest`.
  - recent-writes 用 1.5 秒的時間窗抑制自己寫入造成的推送.
  - React + Tailwind + shadcn/ui,並有 locale 檔.
- Vite 預設不會 watch `node_modules`.

## Goals / Non-Goals

**Goals:**
- 網頁上所有的修改都經過同一套 API 寫入檔案,UI 本身不直接碰檔案系統.
- 預覽與 render 的環境一致.

**Non-Goals:**
- 不做 production build.Vite dev server 就是 runtime.
- 不做 UI 的 e2e 測試,也不寫前端元件的單元測試.
- 不支援手動編輯音效 (延到 v2),也不支援回到前面的階段.

## Decisions

### D1: Vite dev server 就是 studio 的 runtime
`studio/dev.mjs --workspace <path>` (預設是 cwd) 會建立 Vite server,root 是 `studio/app`,只綁 `127.0.0.1`.API、靜態預覽和推送都以 `configureServer` plugin 的形式放在 `studio/server/`.`dev.mjs` 是 server 的入口,由 D12 的 launcher 在背景啟動,listen 之後寫出實際網址;不再有 `pnpm dev`.

- **Why**: 沿用 open-slide 驗證過的模式,前端也有 HMR.
- **Alternative (rejected)**: 另外寫 Node HTTP server,再 build 前端.要多維護 build 流程.

### D2: 寫入請求防護
移植 open-slide 的 `validateMutationRequest`: 強制 JSON content-type,擋掉 `Sec-Fetch-Site: cross-site`、opaque origin,以及 Origin 和 Host 不一致的請求.再加上 Vite 預設的 host 檢查.所有 mutation route 都要經過這個檢查.

- **Why**: 寫入狀態檔等於可以觸發 Claude 執行 prompt.

### D3: API 與檔案的對應
API 只做兩件事: 依檔案契約 (見 add-studio-bridge 的 D2) 讀寫檔案,以及做基本驗證.
- **讀取**: 專案列表 (有 storyboard.json 或 `studio/intake.json` 的專案)、專案內容 (storyboard、treatments、gate 歷史、reply、settings、progress、`audio/plan.json`)、session 與 permission、render 進度、技巧索引.
- **寫入**: reply (只能在 gate 開啟、還沒有 reply 時寫入;依階段驗證 decision 與選填的 `choice`,見 `20261004_161115-gate-reply-choice.md`)、storyboard 欄位與時長 (只能在 gate 開啟時)、settings、Intake (由 slug 規則建立專案目錄)、assignment (指派、重新指派、手動解鎖).
- studio 寫入時用 tmp 檔加上 rename;在 Windows 上遇到 EPERM 或 EBUSY 會重試.讀取時會容忍無法解析的 JSON.
- **改動清單** (gate 開啟期間在網頁上改過的欄位) 寫在 `node_modules/.cinematic-studio/changes/<slug>/<gateId>.json`,studio 是唯一寫入者;回覆時併入 reply 的 `changes`,然後刪除.這樣 studio 重新啟動 (D12 讓最後一個 session 離開時自動停止 studio) 也不會遺失.

### D4: 檔案變動的推送
`video/` 透過 `server.watcher.add` 加入 watcher,變動依類別送出自訂 WS 事件 (`studio:project`、`studio:gate`、`studio:preview`),預覽相關的事件會 debounce.`node_modules/.cinematic-studio/` 不在 watch 範圍,所以 server 每 1 秒輪詢一次 session、permission 和 render 進度,有變化才推送.studio 自己寫入的檔案沿用 recent-writes 時間窗 (1.5 秒) 抑制推送.

- **Why**: 心跳每 5 秒寫一次,放在 watcher 範圍外,可以避免持續產生事件.
- **Trade-off**: session 狀態最多延遲 1 秒.

### D5: 預覽用獨立的靜態 middleware
`/__video/<slug>/` 底下掛一個靜態 middleware,在 Vite 的 HTML middleware **之前**註冊,這樣頁面就不會被 Vite 轉換.
- root 預設是專案目錄,也可以使用 storyboard 宣告的 `renderRoot`.
- MIME 表照抄 render.py.
- 用 `sirv` (要在 `studio/package.json` 明確宣告) 處理 Range,並檢查路徑不能跳出 root.

預覽元件以原生解析度的 iframe 載入,再用 CSS 縮放;等 `window.render` 存在且 `window.ready !== false` 之後,才呼叫 `render(t)` 並 await.

- **Why**: 預覽環境要跟 render.py 一致;Range 讓 `<video>` 可以拖曳播放.
- **Alternative (rejected)**: 交給 Vite 提供頁面.Vite 會注入 client 並改寫 module script.

### D6: 時長順延是純函式
`ripple(shots, plan, shotId, newDuration)` 回傳新的 shots、新的 plan 和改動清單.cue 的歸屬依「起點 ≤ t < 終點」判斷:
- 後面鏡頭的 cue 加上 Δ.
- 被改鏡頭內的 cue 維持原位,列入 `realign`.
- 專案有配樂時 (`audio/` 裡有 music 檔,或 storyboard 的 inputs.Audio 有 score),加上 `music-recut`.

API 會在同一個 gate 時段內依序寫入 storyboard.json 和 plan.json.plan 的每一筆陣列只改第二個元素 (時間),其他欄位原樣保留.

- **Why**: 純函式最容易對邊界情況寫單元測試.只改時間欄位,可以確保 `audio_tools` 的格式不會被破壞.

### D7: 技巧索引在執行時解析
server 啟動時解析 `INDEX.md`: 以 `## ` 標題切分,以每一列連結路徑的前綴決定類別,得到 `{category, name, slug, path, summary}`.讀取專案時,另外掃描專案的 `techniques/<category>/*.md` (專案自訂技巧,見 `20261004_113314-project-custom-techniques.md`),從 frontmatter 的 `name` 與 `Summary:` 行取得同樣的欄位,並標記 `custom: true`;同一個路徑以技巧庫為準.點開技巧時才讀取對應的技巧檔 (技巧庫或專案),以 markdown 顯示.

- **Trade-off**: INDEX.md 的格式一變,解析就會失效,所以要用測試鎖住目前的格式.

### D8: 即時進度的三個來源
- **mod 活動紀錄**: `tool.call` 在呼叫前寫入 start,await 之後寫入 end;寫進 session 檔的 `activity` (最多保留 50 筆).摘要規則是: Bash 取指令的第一個詞和腳本名稱,Agent 取 subagent 的描述,其他工具只記工具名稱.
- **render.py `--progress-file PATH`**: 大約每秒一次,用 tmp 檔加上 `os.replace` 寫入 `{frame, frames, sample, samples, elapsed, eta, updatedAt}`,結束時寫入 `done: true`.沒有帶這個參數時,行為完全不變.
- **Build 進度檔** `video/<slug>/studio/progress.json`: 由 Claude 依協定寫入每顆鏡頭的 `{status, stills[]}`.

這三個來源的寫入者都只有一個.

### D9: mod 協定的擴充
`prompt.compose` 的段落新增以下規則:
- 各階段的 gate payload 要包含哪些內容 (對應 spec 中各 gate 的顯示).
- Build 時要寫入 progress.json.
- 執行 render 時要帶上 `--progress-file node_modules/.cinematic-studio/render/<slug>.json`.
- 收到改動清單後要做哪些同步 (技巧欄位改寫文字與程式碼、`realign` 的 cue 重新對齊、`music-recut` 重剪與重新混音、程式碼與文字中的時間點).

另外補上 add-studio-bridge 沒有涵蓋的喚醒: mod 原本只在 reason 為 `reassign` 時喚醒 Claude.從網頁送出的 Intake 會以 reason `intake` 指派,mod 接手這種指派、且專案還沒有任何 gate 時,用 `[studio project <slug>]` 喚醒 Claude 讀取 `studio/intake.json` 並開始 Intake.studio 指派時,只有「有 intake.json 且還沒有 gate」的專案用 `intake`,其餘用 `reassign`.

### D10: 跳過 gate 的偵測
studio 依「最後一個已核准的 gate 階段」推算目前允許的產出範圍.例如分鏡還沒核准時,不應該出現新的鏡頭 stills 或 `index.html` 的變動;如果 watcher 在 Claude 工作期間看到超出範圍的產出,就送出警告事件.

- **Trade-off**: 這是啟發式的判斷,所以只顯示警告,不阻擋任何動作.

### D11: UI 結構
- 版面依 `20261004_021551-studio-ui-layout.md`.
- 中間區域依 gate 的 stage 切換元件;分鏡存在之後才出現時間軸.
- 狀態管理用 React 的 context 加上 WS 事件,不另外引入狀態管理套件.
- shadcn/ui 產生的元件放在 `app/components/ui`.
- 深色主題用 Tailwind 的 CSS 變數定義.
- 所有字串都放在 `app/locale/{zh-tw,en}.ts`,預設語言依瀏覽器設定,可以手動切換.

### D12: studio 的生命週期由 mod 的 `/studio` 指令管理
依 `20261004_201938-studio-lifecycle-slash-command.md`.mod 在 `session.start` 用 `$.command.register` 註冊 `studio` (`argumentHint: start|stop [--force]|status`),由 `command.run` hook 處理,不經過模型.

- **`server.json`** (`node_modules/.cinematic-studio/server.json`,內容 `{pid, url, workspace, startedAt}`): 唯一的寫入者是 server,listen 之後寫入,直接覆蓋舊檔;launcher 和 mod 只讀取.判斷「正在服務」的方式是對 `url` 發 `GET /api/studio` (回應 `{pid, workspace}`),回應的 pid 要跟 `server.json` 的相同.用 pid 比對可以避開 Windows 上路徑大小寫與斜線的差異;port 被其他 workspace 的 studio 重用時,pid 一定不同.因此被強制結束而留下的舊檔不需要刪除,讀到時視為未啟動.
- **launcher** `studio/start.mjs --workspace <dir> [--no-open]`: 只使用 Node 內建模組 (要在依賴安裝之前執行).
  輸出一行 JSON `{status: "started" | "running", url, opened}`;失敗時把訊息寫到 stderr,exit code 為 1.mod 一律帶上 `--workspace`.
  1. 已經有正在服務的 studio → 輸出 `running` 與網址.
  2. 從 studio 目錄 resolve `vite`,判斷依賴是否已安裝.一般模式和 link 模式都適用: 一般模式往上找到 workspace 的 `node_modules`,link 模式解析到 repo 的 pnpm workspace.不能看 `node_modules` 目錄是否存在,因為 mod 一啟動就會寫入 `.cinematic-studio/`.
  3. 缺少依賴時: workspace 的 skill 路徑是 junction 或 symlink → link 模式,提示到 repo 執行 `pnpm install` 並結束;否則在 workspace 執行 install (優先使用 pnpm,找不到時使用 npm,沿用 init 的偵測方式).
  4. 以 detached 方式啟動 `node dev.mjs --workspace <dir>`,stdio 導向 `node_modules/.cinematic-studio/studio.log`,接著 `unref`.
  5. 等 `server.json` 出現自己啟動的 pid,再輸出 `started` 與網址;逾時就附上 log 的最後幾行,以錯誤結束.
  6. 只有 `started` 才開啟瀏覽器 (Windows `cmd /c start`,macOS `open`,其他平台 `xdg-open`);`--no-open` 給測試使用.
- **mod**:
  - `start`: 以 `$.process.run(['node', <launcher>, ...], { timeoutMs: 600000 })` 執行 launcher,並轉述它的輸出.
  - `stop`: 先讀 `server.json` 確認正在服務.接著排除自己,用跟 studio 相同的 15 秒規則找出其他線上 session;有其他 session 且沒有 `--force` 就拒絕,並列出它們的短 id.
  - 停止的方式: mod 拿不到 platform,所以執行 `studio/stop.mjs --workspace <dir>` (同樣只使用 Node 內建模組;判斷是否正在服務的程式和 launcher 共用 `server-state.mjs`).它先確認 `server.json` 的 pid 仍然是正在服務的 studio,才結束整個 process tree:Windows 用 `taskkill /PID <pid> /T /F`,其他平台結束 detached 啟動時建立的 process group.這樣不會誤殺 pid 已經被重新分配的其他 process.
  - `session.end`: reason 是 `prompt_input_exit`、`logout` 或 `other`,有 `server.json`,而且沒有其他線上 session 時,執行 `stop.mjs`.這段要在大約 1.5 秒內完成,所以 mod 不先發 HTTP 確認,交給 `stop.mjs` 判斷.
  - status line: 沿用現有每 2 秒一次的 poll 讀取 studio 狀態,顯示 `studio <shortId> · <url>`,沒有在執行時顯示 not running;內容有變化時才更新.
  - `open_gate`: 寫入 gate 之後,如果 studio 沒有在執行,工具結果附上一句,要 Claude 提醒使用者執行 `/studio start`.

- **Why**: slash command 由 mod 直接執行,結果穩定,也不花模型回合;「最後一個 session 離開才停止」符合多 session 的設計.
- **Alternative (rejected)**: SKILL.md skill 透過 Bash 啟動;由啟動 studio 的 session 負責停止;server 端閒置監看;保留 `pnpm dev`.取捨見上述 decision.
- **Trade-off**: 沒有閒置監看,所以同時 exit 或 `kill -9` 可能留下 process,交給下次 `start` 沿用,或用 `stop` 停止.
- **Spike 結果 (10.1, Windows 11, Claude Code 2.1.289)**:
  - Claude Code 啟動的子 process 不在任何 Job Object 裡 (`IsProcessInJob` 為 false).
  - 用 Node 模擬 `$.process.run`: host 以 pipe 等 launcher 結束,launcher 以 detached 方式啟動 server,stdio 導向檔案.host 在 launcher 結束後 254 ms 返回;host 結束後 (它的 libuv `KILL_ON_JOB_CLOSE` job 也一起關閉),server 仍然存活.
  - `taskkill /PID <pid> /T /F` 花 143 ms.
  - 已經有 `node_modules/.cinematic-studio/` 的 workspace 可以正常 `pnpm install`,原本的 session 檔會保留;從 skill 的 studio 目錄 resolve `vite` 會找到 workspace 的依賴.
  - `claude -p` 不會載入 project 層的 mod,所以真正 engine 的 `$.process.run` 與 `session.end` 由 10.7 手動確認.

## Testing Seams

接縫是 **studio server 的 HTTP API 加上檔案契約**.vitest 把 server plugin 掛在一個測試用的 Vite server (或直接呼叫 middleware handler),以從 `fixtures/demo` 複製出來的暫存 workspace 為對象,透過 HTTP 呼叫 API,再斷言寫出的檔案:
- request guard.
- 專案列表.
- Intake 與指派.
- reply 的驗證與 decision 種類.
- gate 時才可以編輯.
- 技巧欄位與改動清單.
- ripple 的 API 寫入.
- 靜態預覽 (不轉換、MIME、Range、path traversal).
- INDEX 解析.
- 推送事件.
- 跳過 gate 的警告.
- settings.
- locale key 一致性.

另外兩處用其他方式測試:
- ripple 用純函式單元測試覆蓋邊界情況.
- mod 的活動紀錄用 `claude plugin test`,render.py 的進度檔用 pytest (以 fixture 的 index.html 跑短片).
- launcher 用 vitest 測試: 對暫存 workspace 執行 `start.mjs --no-open`,斷言依賴判斷、link 模式提示、沿用正在服務的 studio,以及 `server.json` 的內容.
- `/studio` 指令、`session.end` 的 reason 篩選與多 session 判斷、status line、gate 提醒,用 `claude plugin test` 搭配 fake engine 測試 (假的 `$.process.run` 與 session 檔).

「拖曳時間軸」的畫面一致性 (預覽和 render.py 的輸出)、完整的 UI 操作,以及 detached process 在真正的 Claude Code 結束後的行為,在 playground 中手動驗證.

## Migration Plan

- 資料格式沒有變動.`audio/plan.json` 和 storyboard.json 會在 gate 時被網頁寫入 (依 gate 狀態錯開寫入時間).
- render.py 新增的是選填參數,舊的指令不受影響.
- 移除根目錄與 workspace 的 `pnpm dev`,改用 `/studio start`.既有 workspace 的 dev script 仍然可以執行 (`dev.mjs` 一樣會寫入 `server.json`),只是不再寫進文件.

## Risks / Trade-offs

- **Vite 對 root 以外 `.html` 變動的處理**: 可能會觸發 studio 頁面 full-reload,要在實作推送時確認,必要時調整 watcher 的事件處理.
- **大型專案的時間軸效能**: 鏡頭和 cue 數量多時,渲染可能變慢.v1 的規模是 30 秒左右、15 顆鏡頭以內,應該不會有問題.
- **跳過 gate 的偵測** 是啟發式的判斷,可能誤報.
- **WebGL 頁面的即時預覽**: 太重的頁面拖曳時會卡頓;預覽只負責顯示,不保證即時的播放幀率.
- **Windows 上 detached process 的存活**: 如果 Claude Code 用 Job Object 管理子 process,server 會隨著啟動它的 session 結束,「最後一個 session 離開才停止」就不成立.
- **`session.end` 的時間限制**: 大約只有 1.5 秒,停止動作超時會留下 process.
- **已經有 `.cinematic-studio/` 的 `node_modules`**: 自動安裝時,pnpm 可能要求重建 modules 目錄.

## Open Questions

- D12 的前提 (detached process 存活、`$.process.run` 在 launcher 結束後立刻返回、1.5 秒內停止、自動安裝) 由 10.1 的 spike 確認;不成立時要先回頭檢討 decision.其他 mod 的相關前提由 add-studio-bridge 的 spike 處理.
