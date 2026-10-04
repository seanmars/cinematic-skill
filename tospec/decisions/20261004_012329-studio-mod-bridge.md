# Web studio 以 project 層 mod + 檔案橋接喚醒 Claude Code

## Status

- proposed
- Date: 20261004_012329
- 取代 `20261004_005437-studio-mcp-gate-bridge.md`

## Context

web studio 需要一條網頁 → Claude 的通道,讓使用者在網頁回覆 gate 後,Claude 能接著做.前一版決策 (`20261004_005437-studio-mcp-gate-bridge.md`) 用 HTTP MCP 的 `await_gate` 長輪詢來實現.grill 查證後發現以下問題:

- **長輪詢成本高**: HTTP MCP 傳輸有 5 分鐘 idle timeout,progress 通知也不會延長 wall-clock 上限 (官方 mcp.md).所以 Claude 必須每 4 分鐘重新呼叫一次,每次都消耗一個 model turn 並增加 context.gate 開著過夜大約要 120 輪.
- **固定 port 不可靠**: Vite 預設沒有 `strictPort`,port 被占用時會默默改用別的 port (open-slide `vite/config.ts:133` 也是這樣).`.mcp.json` 寫死的 URL 可能因此連到別的 workspace.
- **協定寫在 SKILL.md 會被蓋過**: skill 的優先順序是 Personal > Project (官方 skills.md),全域安裝的舊版 SKILL.md 會蓋過 workspace 的副本.
- **其實有方法叫醒閒置 session**: Channels (research preview) 和 mod 的 `$.prompt.submit` 都可以.

本機 Claude Code 2.1.288 附帶的 mod (function hooks plugin) API 提供:
- `$.prompt.submit`: 「a turn of its own, once the session is idle」,reference 明確寫 "background work can wake a quiet session" (`claude-code.d.ts:2733`、`reference.md:132`).
- `$.clock.every` / `$.clock.after`: 從 `session.start` 啟動,一直跑到取消為止.
- `$.fs`: 讀寫檔案.
- `$.tool.register`: 註冊的工具會列成 `mcp__<plugin>__<name>`.
- `prompt.compose`: 在 system prompt 加一段說明.
- `session.start` / `session.end` 事件.
- `reference.md:68`: 「a plugin auto-loaded from a skills folder (`~/.claude/skills/<name>`, the project's `.claude/skills/<name>`)」.
- `CLAUDE_CODE_PLUGIN_DIRS` 只讀 `~/.claude/settings.json`,不讀 project 的 settings.

## Decision

改用 **檔案橋接 + project 層 mod 喚醒**:

- **Bridge**: studio (Vite) 跟 mod 透過狀態檔溝通 (檔案配置見 `20261004_013430-studio-state-file-layout.md`;下文提到的 state.json 一律以該配置為準).mod 透過 `$.tool.register` 提供 gate 工具;Claude 到達 gate 時呼叫工具開啟 gate,然後**結束這一輪,不等待**.mod 用 `$.clock.every` + `$.fs` 輪詢回覆,收到後用 `$.prompt.submit` 喚醒 Claude.等待期間不消耗 model 用量,也沒有 timeout.
- **協定**: mod 用 `prompt.compose` 注入 web 模式的協定,並明訂它在 web 模式下覆蓋 SKILL.md 的單一 gate 規則.因為協定跟著 workspace 內的 mod 版本走,即使全域 SKILL.md 蓋過副本也不受影響.
- **載入**: init 把 skill 複製到 workspace 的 `.claude/skills/cinematic-video/`,並**只在 workspace 內**產生 plugin manifest (`.claude-plugin/plugin.json`、`hooks/hooks.json`),在 workspace 裡直接打 `claude` 就會自動載入.散佈版的 skill 只帶 mod 原始碼,不帶 manifest,所以全域安裝永遠不會啟動 mod.
- **模式偵測**: 有載入 mod 就是 web 模式;舊版 Claude Code 或沒有 mod 就是 CLI 模式.
- **Gate 持有**: 每個專案同時只有一個 Claude session 持有 gate.studio 把專案指派給某個 session id,只有被指派的 mod 會送出喚醒,避免同一個回覆被多個 session 重複喚醒.
- **回覆送達**: 回覆先存成檔案.持有者離線時,由網頁把專案重新指派給線上的 session,被指派的 mod 送出還沒處理 (`deliveredAt` 為空) 的回覆.
- **離線判斷**: mod 寫心跳,而且心跳不受長時間 render 影響.`session.end` 立即標記離線;程序被強制結束時靠心跳逾時 (約 30 秒);保留手動解鎖當備援.
- **Intake**: 只要 workspace 有一個載入 mod 的 session,就可以從網頁開新專案;沒有時網頁會提示先開 Claude.
- **權限**: init 寫入 `.claude/settings.json` 的 allowlist (mod 工具和 skill 的 uv 腳本),並設定 Notification hook (`permission_prompt`) 通知 studio,網頁顯示「Claude 在 terminal 等你授權」.
- **網路防護**: 只綁 localhost,沿用 open-slide `http/request-guard.ts` 的檢查 (強制 JSON content-type、擋 cross-site、Origin 必須等於 Host),再加上 Vite 的 host 檢查.原因是寫入 state.json 等於可以觸發 Claude 執行 prompt.
- **拿掉的部分**: HTTP MCP endpoint、`.mcp.json`、固定 port、strictPort、身分驗證、still-waiting 迴圈.port 回到 Vite 預設,只給瀏覽器使用.

## Impact

- 新增 mod 原始碼 (放在 `skills/cinematic-video/studio/` 底下),manifest 由 init 產生.
- studio: 改成純檔案讀寫 + watch,不提供 MCP endpoint;API 套用 request-guard.
- 狀態檔 schema (gate、回覆、指派、心跳、權限等待),配置見 `20261004_013430-studio-state-file-layout.md`.
- init: 產生 plugin manifest、`.claude/settings.json` (allowlist + Notification hook),不再產生 `.mcp.json`.
- SKILL.md: 新增「載入 mod 時改照 mod 的協定」的說明.

## Alternatives

- **HTTP MCP `await_gate` 長輪詢 (原決策)**: 只用 GA 功能.但每 4 分鐘要消耗一個 turn,要設等待上限,還有 port 串線和 skill 被蓋過的問題.已被本決策取代.
- **背景指令等待後喚醒**: 等待期間不消耗用量.但「背景指令結束時喚醒 Claude」只是在本 session 的工具說明裡觀察到,公開文件沒查到.不採用.
- **Channels 推送**: research preview,需要用 `--channels` 啟動並包成 plugin.列為未來選項.
- **mod 優先,MCP 長輪詢當備援**: 相容性最好,但要做兩套 bridge.不採用.
- **用 `--plugin-dir` 啟動腳本載入 mod**: 機制有記載,但使用者要記得用 `pnpm claude` 啟動.使用者選擇讓 project 層自動載入.
- **包成 plugin 用 marketplace 安裝**: plugin skill 有 namespace,但散佈方式會改變.不採用.
- **允許區網存取 + 一次性 token**: 可以用平板操作,但暴露面變大.不採用.

## Follow-up

1. **Spike (寫 proposal 前完成)**:
   - 全域有同名 skill (沒有 manifest) 時,project 層 skill 資料夾裡的 plugin 還會不會自動載入.
   - `$.prompt.submit` 在閒置 session、以及使用者正在 terminal 打字時的實際行為.
   - 自動載入的 plugin 是否需要 workspace trust 或使用者同意.
   - mod 功能在公開文件中的狀態,以及最低需要的 Claude Code 版本.
2. 定義狀態檔 schema 和 mod 工具介面.
3. 實作 mod (gate 工具、prompt.compose、輪詢、喚醒、心跳、持有權).
4. studio API 套用 request-guard,只綁 localhost.
5. init 產生 manifest、settings allowlist 和 Notification hook.

## Related Changes

## Decision Process

**Q:** 為什麼 gate 需要等待?

Claude Code 是一輪一輪運作的,網頁沒辦法對閒置的 session 說話,所以 Claude 只能停在工具呼叫裡等待;HTTP 的 5 分鐘 idle timeout 又讓它必須反覆重新呼叫.

**Q:** 最近新出的 Claude mod 能不能解決這個問題?

查證 mod API 後確認 `$.prompt.submit` 可以喚醒閒置 session.使用者選擇改用 mod: 檔案橋接 + `$.prompt.submit` 喚醒.

**Q:** workspace 要怎麼載入 mod?

由 init 直接產生 project 層級的 skill 和 plugin mod (之後查證 reference.md:68 確認 project 層 skill 資料夾裡的 plugin 會自動載入).

**Q:** Intake 要不要開放從網頁開新專案?

可以在網頁開新專案.

**Q:** Claude 掛掉後的解鎖要不要改成自動?

mod 心跳自動判斷,保留手動解鎖當備援.

**Q:** studio 對網路開放到什麼程度?

只綁 localhost,沿用 open-slide request-guard.

**Q:** 多個 workspace 和多個 session 怎麼處理?

每個 workspace 指定 port 並驗證身分 (改用 mod 後已不需要);每個專案同時只有一個 session 持有 gate;回覆先存進 state.json.

**Q:** 全域 skill 會蓋過 workspace 副本,要怎麼處理?

協定跟著 studio 走,並加上版本握手 (改用 mod 後由 `prompt.compose` 達成).
