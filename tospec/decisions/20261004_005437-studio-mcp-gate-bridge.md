# Web studio 透過 MCP gate 橋接 terminal 中的 Claude Code

## Status

- superseded
- Date: 20261004_005437
- 被 `20261004_012329-studio-mod-bridge.md` 取代: grill 查證 HTTP MCP 有 5 分鐘 idle timeout,長輪詢的成本和 port 串線風險過高;改用 project 層 mod 搭配 `$.prompt.submit` 喚醒

## Context

使用者希望 cinematic-video 的製作流程能在網頁 studio 上互動完成: 每個階段停下來,在網頁上顯示狀態、修改內容,再決定繼續或重做.這需要一條**網頁 → Claude** 的回推通道.

參考的 open-slide (`F:\workspace\source\open-slide`) 沒有這條通道.它的網頁只透過 Vite plugin 寫檔 (`node_modules/.open-slide/current.json`、`@slide-comment` marker),由 skill 教 agent 讀檔,但每次都要由人回到 terminal 觸發 (例如 `/apply-comments`).整個 repo 沒有 MCP,也不會 spawn Claude.

查證到的限制 (官方 Agent SDK 文件):
- Agent SDK 產品不能使用 claude.ai 登入,只能用 `ANTHROPIC_API_KEY`、Bedrock 或 Vertex 計費.
- 官方文件沒有記載從外部程序推訊息進已在跑的 interactive Claude Code session 的機制.
- MCP tool 可以長時間阻塞,上限由 `MCP_TOOL_TIMEOUT` 控制.

## Decision

studio 的 Vite dev server 同時提供網頁、API 和**固定預設 port 的 HTTP MCP endpoint**.使用者在 terminal 執行的 Claude Code 透過 workspace 的 `.mcp.json` 連上這個 endpoint.

- **`await_gate`**: Claude 在每個 gate 呼叫,工具長時間等待網頁回覆 (approve、revise + 意見,或方案選擇).每 N 分鐘回傳 still waiting,由 Claude 重新呼叫,以規避 timeout.
- **啟動順序**: 先 `pnpm dev`,再開 Claude Code;順序反了就用 `/mcp` 重新連線.
- **Intake 入口**: 在 terminal 打一句啟動指令,Claude 會呼叫 `await_gate(intake)`,之後所有操作都在網頁.因為沒有文件記載的方式能叫醒閒置的 session,Claude 必須正在呼叫工具,才收得到網頁的輸入.
- **中斷恢復**: gate 狀態存在 `video/<slug>/studio/state.json`,新的 session 讀取後可以接續.
- **編輯語意**: 只有停在 gate 時可以編輯.結構化欄位直接寫進檔案,自由意見隨 gate 回覆交給 Claude.Claude 工作中網頁唯讀,但會透過 watch 檔案即時顯示進度.

選擇理由: 沿用使用者現有的 Claude Code 訂閱,而且不用在每個 gate 切回 terminal.Claude 只有在 gate 需要網頁輸入,這跟「工作中唯讀」的編輯語意剛好吻合.

## Impact

- 新增 studio dev server 的 MCP endpoint 和 gate 狀態管理 (`skills/cinematic-video/studio/`).
- 新增 `video/<slug>/studio/state.json` 格式.
- `SKILL.md` 新增 web 模式流程,說明 MCP tool 的使用規則和 still-waiting 重試迴圈.
- `init` 在新 workspace 寫入 `.mcp.json`.

## Alternatives

- **Agent SDK 內嵌在 web server**: 網頁有完整 chat,不用開 terminal.但依政策必須用 API key 按用量計費,不能用訂閱.不採用.
- **純檔案橋接 (open-slide 模式)**: 實作最簡單,但每個 gate 都要回 terminal 打「繼續」,違背「全在網頁完成」的目標.不採用.
- **stdio MCP 由 Claude Code 帶起 studio**: 不用記啟動順序,但多一層程序管理,多個 session 會有 port 衝突,web 的生命週期也被綁在 Claude session 上.不採用.

## Follow-up

1. 設計 MCP tool 介面 (`await_gate` 的輸入、回傳和 still-waiting 協定) 以及 `state.json` schema.
2. 查證 Claude Code 的 MCP tool timeout 預設值,決定 N.
3. 在 Vite dev server 掛 HTTP MCP endpoint,並寫入 gate 狀態.
4. SKILL.md 加入 web 模式流程和 resume 規則.

## Related Changes

## Decision Process

**Q:** open-slide 是怎麼讓網頁跟 Claude 溝通的?

查證後確認不是直接溝通: Vite plugin 寫檔,skill 教 agent 讀檔,由人在 terminal 觸發.整個 repo 沒有 MCP,`cli/dev.ts` 的 `fork` 只是 dev server 的 supervisor.

**Q:** 網頁跟 Claude 要用哪一種溝通方式 (MCP gate、Agent SDK、檔案橋接)?

使用 MCP,但要先確認 open-slide 的做法.確認後維持 MCP.

**Q:** studio 跟 Claude Code 的啟動順序?

先 `pnpm dev`,再開 Claude Code.

**Q:** 新影片從哪裡開始?

在 terminal 打一句啟動指令,之後全部在網頁.

**Q:** gate 等太久或 session 被關掉怎麼辦?

gate 狀態存檔,新 session 可以接續.

**Q:** 網頁上的修改怎麼生效?

欄位直接改檔,意見交給 Claude,只有在 gate 時可以編輯.
