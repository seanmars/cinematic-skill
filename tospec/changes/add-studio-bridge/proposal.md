## Why

要讓使用者在網頁回覆 gate 後 Claude 自動接續,必須先有一條網頁 → Claude 的通道.open-slide 只有單向的檔案橋接;Agent SDK 不能使用訂閱登入;HTTP MCP 長輪詢有 5 分鐘的 idle timeout.Claude Code 的 mod 可以用 `$.prompt.submit` 喚醒閒置的 session,而且放在 project 層 skill 資料夾的 plugin 會自動載入.本 change 先用 spike 驗證這些前提,再建立 init 與 mod,把「Claude 停在 gate → 回覆檔出現 → Claude 被喚醒」這條路徑打通,作為 add-web-studio 的基礎.依據 ADR: studio-in-skill-distribution、studio-mod-bridge、studio-state-file-layout、studio-init-dev-loop、web-mode-stage-gates、skill-md-and-gate-enforcement、v1-testing-strategy.依賴 add-production-data.

## What Changes

- **新增 spike**: 驗證 mod 的載入與喚醒規則,包括全域同名 skill、在 repo 子目錄當 cwd、trust 確認、閒置時喚醒、最低版本、hooks 模組路徑、`classic.Notification`.結果不符預期時,先更新設計再繼續.
- **新增 init 腳本**: 只建立新目錄,並先檢查 Node 與 pnpm.一般模式會把 skill 複製到 workspace 的 project 層 skill 資料夾,產生 mod manifest、workspace 標記、package.json、Claude Code 設定 (allowlist 與權限提示的 Notification hook)、gitignore 和 video 目錄.link 模式只給本 repo 開發使用,會連結原始碼,而 manifest 路徑已被 gitignore.
- **新增 studio mod**:
  - 偵測 workspace 標記,判斷是否進入 web 模式.
  - 透過 system prompt 注入協定,讓每個階段都開 gate.
  - 提供 gate 工具,auto-continue 時直接回傳.
  - 輪詢指派給自己的專案的回覆,用 prompt.submit 喚醒 Claude,並寫入送達時間.
  - 心跳、離線標記、status line 短 id、重新指派時的接續喚醒.
  - Build 精修 gate 還沒核准時,擋下整片的高畫質 render.
- **新增狀態檔契約與 schema**: gate、reply、assignment、session.每個檔案只有一個寫入者.
- **新增本 repo 的開發骨架**: pnpm workspace、studio 依賴宣告、vitest、mod 測試、playground,以及避開 gitignore 目錄名稱陷阱的檢查.
- **修改 SKILL.md**: 加上精簡的模式說明 (有載入 studio mod 時,照 mod 的規則).

## Capabilities

### New Capabilities
- `studio-workspace`: init 建立 studio workspace 的行為 (前置檢查、複製與排除、manifest、設定檔、link 模式) (maps to specs/studio-workspace/spec.md)
- `studio-bridge`: mod 與檔案橋接 (模式偵測與協定注入、gate 工具、回覆送達與喚醒、指派與 session 狀態、昂貴動作的防護) (maps to specs/studio-bridge/spec.md)

### Modified Capabilities
- (無)

## Impact

- **skill**: 新增 studio 目錄 (init、權限通知腳本、mod 原始碼與測試、依賴宣告);在 schema 目錄新增 gate、reply、assignment、session 的 schema;SKILL.md 加上模式說明.
- **散佈**: 散佈的 skill 不含 manifest,所以全域安裝不會啟動 mod.web 模式需要 Node 與 pnpm (沒有 pnpm 時退回 npm),以及支援 function hooks 的 Claude Code;版本不支援時退回 CLI 模式.
- **本 repo**: 新增根目錄 package.json、pnpm workspace、gitignore 規則 (playground、原始碼中的 manifest)、playground (由 link 模式建立,現有的 lunelle 專案搬進去).
- **使用者專案**: 新的 workspace 會有 Claude Code 專案設定 (allowlist 與 hook),專案的 studio 狀態目錄會進 git.
- **安全**: 寫入回覆檔等於可以觸發 Claude 執行 prompt;網頁端的防護在 add-web-studio 處理.
