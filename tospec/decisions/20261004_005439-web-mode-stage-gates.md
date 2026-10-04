# web 模式每階段 gate 可設 auto-continue, CLI 模式維持單一 approval gate

## Status

- proposed
- Date: 20261004_005439

## Context

`SKILL.md:95` 明確規定 Treatments 的 sign-off 是「the only approval gate」,之後要自主完成製作,不逐步詢問.使用者希望在 web studio 裡每個階段都能停下來確認或修改.CLI 模式要保留 (web 是選用的),而且這個 skill 是公開散佈的,很多使用者只會用 terminal.

## Decision

- **模式偵測**: 有載入 studio mod 就是 web 模式 (協定由 mod 的 `prompt.compose` 注入,見 `20261004_012329-studio-mod-bridge.md`);沒有就是 CLI 模式,行為跟現在完全一樣.
- **Intake**: 只要 workspace 有一個載入 mod 的 session,就可以從網頁開新專案.
- **web 模式的 gate 順序**: Intake → Treatments (選擇、混搭或修改) → 分鏡 (附 storyboard critic 結果) → Assets (有素材才停) → Build animatic → Build 精修完成 (高畫質 render 前) → Audio → 每輪 Gauntlet → Deliver.
- 每個 gate 可以個別設 auto-continue,設定存在專案的 `studio/settings.json` (見 `20261004_013430-studio-state-file-layout.md`).
- Build 過程中不逐顆停,但網頁會即時顯示每顆鏡頭的進度和 stills.
- v1 範圍: gate 流程、專案列表與切換 (只有 Claude 正在處理的專案能操作 gate)、Treatment 方案卡、分鏡卡片編輯、`render(t)` 時間軸預覽;音訊從 `audio/plan.json` 顯示,手動編輯音效延到 v2.唯一的例外是修改鏡頭時長時,網頁會自動平移後續的 cue (見 `20261004_021551-timeline-duration-ripple.md`).

選擇理由: 符合「每階段可停」的需求,又能跳過不想管的階段,避免 commercial 片型 12-15 個鏡頭時一直被打斷.CLI 使用者不受影響.

## Impact

- `SKILL.md` 要依模式分支: CLI 模式維持單一 gate 的規則;web 模式改成在每個階段呼叫 mod 的 gate 工具,然後結束這一輪,由 mod 喚醒.
- 新增 `studio/settings.json` 的 gate 設定欄位.
- studio UI 的 gate 面板、各階段面板和進度顯示.

## Alternatives

- **只停關鍵里程碑 (4 個點)**: 比較接近原本的 skill 哲學,但不符合「每階段可停」.不採用.
- **連每顆鏡頭都停**: 控制最細,但 gate 太多.不採用,改成即時顯示進度.
- **Build 只在全部完成時停一次**: gate 比較少,但節奏問題要到精修後才會發現.不採用.
- **web 為主,CLI 也改成每階段 gate**: 會改變現有 CLI 使用者的體驗.不採用.

## Follow-up

1. 定義各階段的 gate payload (要顯示什麼、可以回覆什麼).
2. 改寫 SKILL.md 的 Workflow,加入模式分支.
3. 實作 auto-continue 設定和網頁上的 gate 面板.

## Related Changes

## Decision Process

**Q:** 網頁版要在哪些地方停下來?

每個階段都停,每個階段可以個別設自動繼續.

**Q:** 加了 web 之後,純 terminal 的用法還要保留嗎?

保留,web 是選用的.

**Q:** Build 階段的 gate 放在哪裡?

animatic 停一次,精修完成後再停一次.

**Q:** v1 範圍?

gate 流程 + 方案卡 + 分鏡卡 + 時間軸預覽,音訊唯讀.

**Q:** 重述裡推論出的「每輪 Gauntlet 都停」是否正確?

正確.
