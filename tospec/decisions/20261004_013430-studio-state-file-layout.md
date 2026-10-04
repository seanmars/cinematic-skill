# studio 狀態檔: 一個檔案一個寫入者, 持久與暫存分離, 請求指定 session

## Status

- proposed
- Date: 20261004_013430

## Context

`20261004_012329-studio-mod-bridge.md` 決定用「檔案 + project 層 mod 喚醒」連接 studio 和 Claude Code.原本設想所有狀態都放在單一的 `video/<slug>/studio/state.json`,第二輪 grill 發現以下問題:

- **互相覆蓋**: mod 每幾秒寫一次心跳,studio 寫入網頁回覆,兩邊都是「讀出 → 修改 → 整個寫回」,後寫的會蓋掉先寫的,網頁回覆可能被心跳蓋掉.
- **mod 的檔案操作有限**: `$.fs` 只有 `read`、`write`、`list`、`exists`、`stat`、`ancestors`,沒有 rename、delete、append、watch,`write` 也沒有保證 atomic (`claude-code.d.ts:3015-3060`).所以 mod 沒辦法做 tmp + rename 的原子寫入,也做不出可靠的鎖.
- **多 session 搶單**: 同一個 workspace 的多個 mod 都會看到同一個 Intake 請求或回覆,結果會被重複喚醒.
- **重複送出**: 如果「已送出」的標記放在暫存區,清掉 node_modules 後新 session 接續時會再送一次,Claude 就會把同一個 gate 執行兩次.
- **open-slide 的先例**: 暫存狀態放在 `node_modules/.open-slide/current.json`,用 tmp + rename 寫入 (`current-plugin.ts:69-71, 135-136`).Vite 預設不會 watch node_modules.

## Decision

**一個檔案只有一個寫入者**,並把持久資料和暫存資料分開放:

| 位置 | 檔案 | 寫入者 |
|---|---|---|
| `video/<slug>/studio/` (持久,進 git) | `intake.json` | studio |
| | `gates/<gateId>.json` (開 gate 時寫入,送出回覆後補 `deliveredAt`) | 持有該專案的 mod |
| | `replies/<gateId>.json` | studio |
| | `settings.json` (auto-continue) | studio |
| | `progress.json` (Build 時每顆鏡頭的狀態和 stills,見 `20261004_014759-storyboard-schema-technique-slots.md`) | Claude |
| `node_modules/.cinematic-studio/` (暫存) | `sessions/<sessionId>.json` (心跳、授權等待、短 id、目前專案) | 各自的 mod |
| | `assignments/<slug>.json` (專案指派給哪個 session) | studio |

- **雙寫入者例外**: `storyboard.json` 和 `audio/plan.json` 由 Claude 在工作時寫入,網頁只在 gate 時寫入,兩邊靠 gate 狀態錯開時間;使用者送出回覆後,網頁就恢復唯讀 (見 `20261004_021551-timeline-duration-ripple.md`).

- **請求指定 session**: studio 把每個專案 (包括 Intake 和重新指派) 指派給特定的 session id.mod 只處理指派給自己的專案,只送出 `deliveredAt` 為空的回覆,不需要搶鎖.
- **送出標記持久化**: `deliveredAt` 寫在專案內的 gate 檔裡,清掉 node_modules 也不會重複送出.
- **讀寫容錯**: 讀取的一方要容忍讀到寫一半的 JSON,下一輪再讀.studio 寫檔用 tmp + rename,Windows 遇到 EPERM 時要重試.
- **Intake**: 網頁送出時就由網頁決定 slug,建立 `video/<slug>/studio/intake.json`,然後指派給 session (只有一個時自動選);當下沒有 session,內容也不會遺失.
- **重新指派**: 持有者離線時,網頁會讓你選線上的 session 接手,被指派的 mod 會用「接續專案 X 的 gate Y」喚醒 Claude.
- **Session 標籤**: mod 用 `$.ui.status` 在 terminal 顯示短 id,網頁顯示同一個 id、啟動時間和狀態.
- **版控**: `video/<slug>/studio/` 進 git,當作專案的決策紀錄 (跟 brief.md、qa/review_log.md 同類).

選擇理由: 只要每個檔案只有一個寫入者,mod 不需要 rename 或鎖也能安全運作.暫存資料放 node_modules 可以避開 watcher 的雜訊和 git 異動.所有指派都由 studio 決定,就不會有搶單的情況.

## Impact

- 定義 intake、gate、reply、settings、session、assignment 六種檔案的 schema.
- mod: 心跳寫入、只輪詢指派給自己的專案、寫入 `deliveredAt`.
- studio: 指派與重新指派的 UI、Intake 時建立 slug、tmp + rename 寫入並在 Windows 上重試.
- init 產生的 `.gitignore` 不排除 `video/*/studio/`.

## Alternatives

- **單一 state.json + 鎖檔**: 檔案比較少,但 mod 沒有 rename 和 delete,做不出可靠的鎖,還可能留下死鎖檔.不採用.
- **全部放 `video/<slug>/studio/`**: 位置單純,但心跳會造成 watcher 一直收到事件,git 也一直有異動.不採用.
- **第一個搶到的 session 處理 Intake**: 使用者不用選,但會有兩個 session 同時開工的風險.不採用.
- **Intake 只當暫存請求,由 Claude 建立專案**: 跟 CLI 一致,但 session 掛掉或重裝依賴時,使用者輸入的想法會遺失.不採用.
- **新 session 自動認領孤兒專案**: 不用操作,但會搶單.不採用.
- **studio 資料不進 git**: 修改意見不會公開,但換機器就沒辦法接續.不採用.

## Follow-up

1. 定義六種檔案的 JSON schema 和 gateId 的命名規則.
2. 定義 slug 規則 (kebab-case、檢查是否重複).
3. 實作讀取容錯和 studio 端的原子寫入 (Windows EPERM 重試).
4. 實作指派、重新指派、session 標籤的 UI.

## Related Changes

## Decision Process

**Q:** studio 狀態檔要怎麼切分,才能避免互相覆蓋?

一個檔案一個寫入者,請求指定給特定 session.

**Q:** 狀態檔要放在哪裡?

持久資料放專案,短暫資料放 `node_modules/.cinematic-studio/`.

**Q:** 多個 session 時,從網頁開的新專案要交給誰?

由網頁選擇,只有一個 session 時自動選.

**Q:** Intake 要怎麼保存?

網頁送出時就建立專案資料夾,寫入持久的 intake.json.

**Q:** 持有者離線後怎麼接續?

由網頁重新指派給線上的 session.

**Q:** `video/<slug>/studio/` 要不要進 git?

要,當作專案的決策紀錄.
