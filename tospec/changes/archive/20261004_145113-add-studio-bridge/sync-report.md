# Sync Report: add-studio-bridge
## Summary
Conclusion: PASS
## Requirements
### 依 mod 是否載入決定模式
- Implementation: studio mod 的 `prompt.compose` hook 只在有 workspace 標記的 session 中加入 `cinematic-video:web-mode` 協定段落 (每個階段開 gate、覆蓋單一 gate 規則);SKILL.md 保留 CLI 的單一 approval gate,並加一句 web 模式的例外.
- Verdict: MATCH
- Notes: playground 實測,在一般 session 與「全域放舊版 SKILL.md」的 session 中,Claude 都在 intake 結束時自行開 gate 並結束這一輪.

### gate 工具開啟 gate 後結束這一輪
- Implementation: mod 註冊的 `open_gate` 工具,依 `gates/` 中最大的序號加一寫入新的 gate 檔;專案 settings 的 auto-continue 列出該階段時,標記 `autoContinue` 並回傳已核准,否則回傳「結束這一輪並等待」的指示.
- Verdict: MATCH
- Notes: 由 mod 測試與 playground 端對端驗證.

### 回覆送達並喚醒 Claude,不重複處理
- Implementation: mod 的輪詢計時器只處理指派給自己的專案,在 gate 沒有 `deliveredAt` 時讀取 reply,以帶 gateId、decision、notes、changes 的 prompt.submit 喚醒,新的一輪開始後才寫入 `deliveredAt`;讀不到或無法解析的檔案略過,下次重試;輪詢不重疊;協定要求忽略已處理過的 gateId.
- Verdict: MATCH
- Notes: 實測 reply 寫入後約 1 秒送達.

### 指派與 session 狀態
- Implementation: mod 依 assignment 的 sessionId 過濾專案;`reason` 為 `reassign` 的新指派會先送出「接續目前 gate」的指示,接手的專案記錄在自己的 session 檔 (hot reload 後不會重送);心跳計時器每 5 秒寫入 session 檔,status line 顯示短 id,`session.end` 時標記離線.
- Verdict: MATCH
- Notes: 實測重新指派給新 session 後,Claude 接手上一個 session 的進度,並收到分鏡的回覆.

### 未核准時擋下整片高畫質 render
- Implementation: mod 在 Bash 與 PowerShell 的 `tool.call` 判斷 skill 的 render.py 呼叫: 輸出在 `out/` 下的影片、沒有 `--still` 或 `--seek-test`、從 0 秒開始且長度涵蓋 storyboard 的總長,而且 build-polish gate 沒有核准、也沒有設定 auto-continue 時,回傳要求先開 gate 的 deny.
- Verdict: MATCH
- Notes: 讀不到 storyboard 時不擋 (依 D5 的窄規則);判斷的細節記在 design D5.

### init 的前置檢查
- Implementation: init 依序檢查參數、`studio/package.json` engines 的 Node 下限、目標目錄 (非隱藏檔案需要 `--force`) 與 seed,全部通過才寫檔;一般模式偵測 pnpm,把結果用在下一步指示中.
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 原文寫「安裝依賴時 SHALL 優先使用 pnpm」,但 init 不會安裝依賴,只在下一步指示中列出 pnpm 或 npm 的指令.已更新 Requirement 內文與「沒有安裝 pnpm」情境的 THEN;`tospec validate` 通過,沒有 issue.

### 一般模式把 skill 複製到 project 層
- Implementation: init 把執行中的 skill 複製到 `.claude/skills/cinematic-video`,排除 node_modules、`__pycache__`、`*.pyc` 與 manifest 路徑 (包含引擎在 manifest 旁產生的 `tsconfig.json`).
- Verdict: MATCH
- Notes: 引擎產生的 `tsconfig.json` 屬於 manifest 的範圍,記在 design D7.

### mod 的 manifest 只在 workspace 產生
- Implementation: init 在 workspace 的 skill 副本內寫入 `.claude-plugin/plugin.json`、`hooks/hooks.json` 與 workspace 標記;repo 的 `.gitignore` 排除原始碼中的 manifest 路徑;mod 在沒有標記的目錄中不註冊任何東西.
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: spike 與 8.1 實測,Claude Code 只在接受 workspace trust 後才採用 project 層的 plugin (接受後同一個 session 就會載入).已在 Requirement 內文與「在 workspace 啟動 Claude Code」情境的 THEN 加上 trust 條件;`tospec validate` 通過,沒有 issue.

### init 產生 workspace 的設定檔
- Implementation: init 寫入 package.json (dev script 與取自 `studio/package.json` 的 dependencies)、`.claude/settings.json` (allowlist 與 `permission_prompt` 的 Notification hook)、`.gitignore`、`video/`,不寫 MCP 設定;`notify.mjs` 依 hook 輸入的 cwd 與 session id 寫入等待授權的紀錄.
- Verdict: MATCH
- Notes: 由 vitest 驗證.

### link 模式供本 repo 開發使用
- Implementation: `--link` 用 junction (Windows) 或 symlink 連結 skill 原始碼,manifest 透過連結寫入原始碼中已被 gitignore 的路徑,不寫 package.json.
- Verdict: MATCH
- Notes: 由 vitest 驗證,playground 以這個模式建立.
