# Design: add-studio-bridge

## Context

- skill 目前只有 Python 工具鏈,repo 沒有 package.json 和測試.add-production-data 會新增 skill 層級的 `schema/` 和 repo 根目錄的 `fixtures/`.
- repo 的 `.gitignore` 是通用範本,會排除 `lib/`、`build/`、`dist/`、`out`、`var/`、`target/`、`parts/`、`downloads/`、`env/`、`node_modules/`、`__pycache__/`.`npx skills add` 只抓 git 追蹤的檔案.這個 repo 自己的 `.claude/skills/cinematic-video` 是指向 `.agents/skills/cinematic-video` 的連結,而那是從 GitHub 安裝的副本.
- mod (Claude Code 2.1.288 附帶的 plugin-authoring 說明):
  - 執行環境沒有 Node,也沒有 DOM.
  - `$.fs` 只有 read、write、list、exists、stat、ancestors,沒有 rename、delete、watch.
  - `$.clock.every` 和 `$.clock.after` 要在 `session.start` 啟動.
  - `$.prompt.submit` 會在 session 閒置時開始新的一輪,並在那一輪開始時 resolve.
  - `$.tool.register` 註冊的工具會列成 `mcp__<plugin>__<name>`.
  - `tool.call` 可以 deny,也可以 await 後觀察結果.
  - 放在 `~/.claude/skills/<name>` 或專案 `.claude/skills/<name>` 的 plugin 會自動載入.
  - `CLAUDE_CODE_PLUGIN_DIRS` 不讀專案的設定.
- Claude Code 的 skill 優先順序是 Personal 高於 Project (官方 skills 文件).Notification hook 的 `permission_prompt` matcher 是 GA 功能.
- 參考實作 open-slide: init 的 template 複製在 Windows 上改用複製 (避開 symlink 權限)、用 hash 偵測 drift、`node_modules/.open-slide/` 放暫存狀態.

## Goals / Non-Goals

**Goals:**
- 不靠網頁,只用檔案就能完整走完「開 gate → 回覆 → 喚醒 → 送達標記」這條路徑,並寫成自動化測試.
- 在投入 studio UI 之前,先確認 mod 的載入與喚醒規則成立.

**Non-Goals:**
- 網頁、HTTP API 和 request guard 屬於 add-web-studio.本 change 的回覆檔由測試或手動寫入.
- 活動紀錄、render 進度和 Build 進度檔屬於 add-web-studio.
- workspace 內 skill 副本的同步與 schema 遷移.

## Decisions

### D1: studio 目錄配置要避開被 gitignore 的名稱
本 change 在 skill 下建立 `studio/`,內容有 `init.mjs`、`notify.mjs`、`package.json`、`mod/` (`register.ts` 與 `*.test.ts`) 和 `test/` (vitest).後續 add-web-studio 會再加入 `app/` 和 `server/`.任何層級都不能使用會被 `.gitignore` 排除的名稱,由 D7 的檢查保證.

- **Why**: 被 ignore 的目錄在本機能動,但散佈出去就會缺檔.

### D2: 檔案契約與 gate 生命週期
寫入者對照表見 `20261004_013430-studio-state-file-layout.md`.gate、reply、assignment、session 的 JSON Schema 放在 skill 層級的 `schema/`,跟 add-production-data 放在一起.gate 的生命週期:

```text
gates/<seq>-<stage>.json   (mod 寫)        replies/<seq>-<stage>.json (studio 或測試寫)
  open ──(auto-continue)──────────────▶ approved (工具直接回傳,不寫 reply)
  open ──(寫入 reply)──▶ replied ──(mod: submit 成功後寫 deliveredAt)──▶ delivered
```

- **gateId** 的格式是 `<三位數序號>-<stage>`,stage 是 `intake`、`treatments`、`storyboard`、`assets`、`build-animatic`、`build-polish`、`audio`、`gauntlet`、`deliver` 其中之一.
- **reply** 包含 `decision`、`notes` 和 `changes`.
- **assignment** 的內容是 `{ slug, sessionId, assignedAt, reason }`.
- **session** 的內容是 `{ sessionId, shortId, startedAt, heartbeatAt, online, project }`.

- **Why**: mod 沒有 rename 和 lock;每個檔案只有一個寫入者,而且只新增不改寫,就不需要鎖.
- **Alternative (rejected)**: 單一 state.json 加鎖檔.

### D3: mod 的結構
`session.start` 時:
1. 讀取 cwd 的 workspace 標記 (`studio.config.json`),沒有就什麼都不註冊.
2. 註冊 `open_gate` 工具.
3. 用 `$.clock.every` 啟動兩個計時器: 輪詢 (約 2 秒) 和心跳 (約 5 秒).
4. 在 `$.ui.status` 顯示短 id.

輪詢時,mod 先讀取 `node_modules/.cinematic-studio/assignments/` 找出指派給自己的專案,再找出這些專案中有 reply、但 gate 還沒有 `deliveredAt` 的 gate.如果指派是新的 (重新指派),就送出接續指示.

其他 hook:
- `prompt.compose`: 加入 web 模式的協定段落,內容包含每個階段都開 gate、覆蓋單一 gate 規則、略過已處理的 gateId、收到改動清單後要同步哪些內容.
- `tool.call` (Bash): 依 D5 判斷是否要 deny.
- `session.end`: 把 session 檔標成離線.

- **Why**: 由 mod 自己檢查 workspace 標記,就算 manifest 意外出現在全域副本,也不會在其他專案啟動.
- **Trade-off**: 輪詢有約 2 秒的延遲.mod 沒有 watch 的 API,這是能做到的最快方式.

### D4: 送達順序是先 submit,再寫 deliveredAt
mod 先 `await $.prompt.submit(...)`,等新的一輪開始之後,才把 `deliveredAt` 寫進 gate 檔.喚醒 prompt 的開頭帶上 gateId,協定也要求 Claude 遇到已處理過的 gateId 時直接略過.

- **Why**: 如果先寫 deliveredAt,只要在 submit 之前當掉,回覆就永遠遺失;後寫的話,最壞的情況只是重複送達,而帶上 gateId 可以讓 Claude 自己辨識.
- **Trade-off**: 實際的保證是「至少一次,並可辨識重複」.

### D5: 擋下整片 render 的判斷規則
Bash `tool.call` 的指令要**全部符合**以下條件才會被 deny:
- 呼叫的是 skill 的 render.py.
- 輸出路徑在專案的 `out/` 底下,而且是影片檔.
- 沒有 `--still` 或 `--seek-test`.
- 沒有用 `--start` 和 `--duration` 指定部分時段 (或指定的時段涵蓋整片).
- 該專案最新的 `build-polish` gate 還沒核准,而且也沒有設定 auto-continue.

deny 訊息會要求 Claude 先呼叫 `open_gate(build-polish)`.

- **Why**: 規則越窄越不容易誤擋;要防的只有最貴的那一個動作.

### D6: init 用純 ESM 實作,不依賴 git
`init.mjs` 只使用 Node 內建模組,排除清單直接寫死 (`node_modules`、`__pycache__`、`*.pyc`、manifest 路徑),因為透過 `npx skills add` 安裝的副本沒有 `.git`.產生的檔案如下:
- manifest: `.claude-plugin/plugin.json` 和 `hooks/hooks.json`,指向 `studio/mod/register.ts`.如果 spike 發現不能引用 hooks 目錄外的路徑,就改成產生一個 re-export stub.
- workspace 標記: `studio.config.json`,內容包含 skill 版本.
- `package.json`: 依賴取自 `studio/package.json`.
- `.claude/settings.json`: allowlist 包含 `mcp__cinematic-video__*` 和 skill 的 uv 腳本;Notification hook 的 matcher 是 `permission_prompt`,執行 `node <skill>/studio/notify.mjs`,把等待狀態寫到 `node_modules/.cinematic-studio/permission/<session_id>.json`.
- `.gitignore` 和 `video/`.

Node 版本的下限取自 `studio/package.json` 的 `engines`.

- **Why**: 依賴越少,在使用者的環境越不容易失敗;等待授權的資訊由 hook 腳本寫在自己的檔案裡,維持一個檔案一個寫入者.
- **Alternative (rejected)**: 由 mod 透過 `classic.Notification` 記錄等待狀態.這樣不需要 settings hook,但 mod 能不能收到這個事件還沒驗證,先列入 spike.

### D7: link 模式、開發骨架與 gitignore 檢查
- **link 模式**: Windows 用 `fs.symlink(target, path, 'junction')`,其他平台用一般的 symlink;manifest 寫進原始碼目錄,而這些路徑已經在 repo 的 `.gitignore` 裡.`--seed <fixture>` 會把 fixture 複製進 workspace 的 `video/`.
- **repo**: 根目錄 `package.json` 設為 private;`pnpm-workspace.yaml` 包含 `skills/cinematic-video/studio`;`pnpm test` 依序執行 vitest、mod 測試 (`claude plugin test`) 和 pytest.
- **gitignore 檢查**: 由 vitest 列出 `git ls-files --others --ignored --exclude-standard skills/cinematic-video`,除了 manifest 和快取之外不能有其他檔案;不在 git repo 裡時就略過.
- **playground**: `playground/` 由 `init --link --seed fixtures/demo` 建立,現有 untracked 的 `video/lunelle-promo` 搬進 `playground/video/`.

### D8: 先做 spike,結果決定是否繼續
第一批 task 用一個最小的 mod (只做 `session.start` 寫檔、一個工具、一個計時器、`prompt.submit`) 驗證 Open Questions.每一項都要記錄結果;只要有任何一項不成立,就先更新本 design、相關 ADR 和後續 tasks,再繼續.

## Testing Seams

接縫在 **workspace 的檔案契約** (D2).

- **mod**: 用 `claude plugin test` 搭配暫存 workspace 的檔案.寫入 assignment 和 reply 之後執行計時器,斷言 `prompt.submit` 剛好被呼叫一次、`deliveredAt` 已寫入、只處理指派給自己的專案、心跳與離線標記,以及 D5 的 deny 規則.
- **init**: 用 vitest 對暫存目錄執行 `init.mjs` (一般模式和 link 模式),斷言產生的檔案、排除規則和錯誤情況;`notify.mjs` 則以 stdin 輸入,斷言寫出的檔案.
- **gitignore 檢查**: vitest.

「載入 mod 的 session」「全域的舊版 SKILL.md 蓋過副本」「在 workspace 啟動 Claude Code」「全域安裝的 skill」這幾項屬於 Claude Code 的行為,由 spike 和最後的端對端驗證處理,不寫自動化測試.

## Migration Plan

- SKILL.md 只新增一段模式說明.CLI 模式 (沒有 mod) 的行為不變.
- 已經全域安裝的使用者不受影響: 散佈的 skill 不含 manifest,mod 不會啟動.
- 本 repo: `video/lunelle-promo` (untracked) 搬到 `playground/video/`.

## Risks / Trade-offs

- **mod 是新功能**: 公開文件上的狀態和最低版本還不確定,由 spike 確認.版本不支援時會退回 CLI 模式.
- **重複送達的時間窗** (D4).
- **Windows**: junction 和 symlink 的差異,以及 hook 指令的路徑分隔符號.
- **模型不遵守協定**: 除了 D5 的那一個動作,其他都只靠協定;網頁上的警告在 add-web-studio 處理.

## Open Questions

以下由 spike (D8) 回答:
1. 全域有同名 skill (沒有 manifest) 時,project 層 skill 資料夾裡的 plugin 還會不會自動載入?
2. 在 git repo 的子目錄 (playground) 開 Claude Code 時,哪一個 `.claude/skills` 會被當成 project 層?
3. 自動載入的 plugin 是否需要 workspace trust 或使用者同意?
4. `$.prompt.submit` 在閒置 session、以及使用者正在 terminal 打字時的實際行為?
5. mod 功能需要的最低 Claude Code 版本,以及在公開文件中的狀態?
6. hooks.json 能不能引用 hooks 目錄外的模組?
7. mod 能不能透過 `classic.Notification` 收到權限提示事件?
