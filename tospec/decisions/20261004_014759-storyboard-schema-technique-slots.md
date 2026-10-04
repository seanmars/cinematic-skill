# storyboard 結構: 結構化骨架 + 自由文字 + 技巧欄位

## Status

- proposed
- Date: 20261004_014759

## Context

`20261004_005438-storyboard-json-ssot.md` 決定以 storyboard.json 作為分鏡 SSOT,但還沒定義每顆鏡頭的欄位要細到什麼程度.第三輪 grill 對照 skill 現有文件時發現:

- `brief-template.md` 規定每顆鏡頭有 Picture/Job/Action/Shot/Camera/Audio/Transition.但實際寫得好的 brief (`video/lunelle-promo/brief.md`) **沒有完全照範本**: 運鏡、時間點和情緒都寫在 Picture 的一大段文字裡 (例如「8.6 起手機前傾 rotX -9 + 推到 1.19 (湊近聽)」),Action/Shot 欄位也常常沒有.
- 技巧庫 `techniques/INDEX.md` 已經有結構: 依類別列出 424 個技巧的名稱、一句話摘要和路徑 `<category>/<slug>.md`.`shot-design.md` 也要求 Claude 為每顆鏡頭挑選鏡頭大小、角度、運鏡和轉場.
- Treatments 目前**只寫在對話裡** (`treatments.md` 的範本),網頁沒有檔案可以讀.
- 使用者希望網頁上能直接挑選鏡頭大小、角度、運鏡、轉場等技巧.

## Decision

**每顆鏡頭用結構化骨架 + 自由文字內容 + 技巧欄位**:

- **結構化骨架**: id、順序、時長 (起訖時間依順序推算,見 `20261004_021551-timeline-duration-ripple.md`)、素材引用.
- **技巧欄位**: 值一律引用 `techniques/<category>/<slug>.md` (技巧庫或專案自訂技巧檔,見 `20261004_113314-project-custom-techniques.md`).
  - 四個主欄位各單選一個,都可以留空: framing (鏡頭大小)、camera-angles (角度)、camera-movement (運鏡)、editing (轉場).
  - 其他類別 (lenses、composition、lighting、color、atmosphere、time-and-motion、effects、genre-looks、viral-looks) 用多選標籤.
  - 網頁挑選時顯示 `INDEX.md` 的摘要,點進去可以看完整的技巧檔.技巧資料由 studio 在**執行時直接解析 `INDEX.md`**,不另外維護 JSON.
- **自由文字**: Picture、Job、Action、Camera、Audio、Transition,保留時間點和情緒等細節.
- **最上層**: 對應 brief 範本的 inputs、direction、beat grid、build、gotchas.
- **技巧欄位代表意圖**: Claude 寫分鏡時要填好四個主欄位.使用者在網頁上換了技巧,gate 回覆會附上「改了哪些欄位」,由 Claude 依新的技巧改寫自由文字和程式碼.

**相關檔案**:
- **`treatments.json`**: 由 Claude 寫入,欄位對應 `treatments.md` 範本 (標題、logline、Look 與色票、specs、stack、shot breakdown、signature moves、audio、估時與風險、why it fits、preview 路徑).選定後,內容寫進 storyboard.json,沒選的方案留著當紀錄.跟 storyboard.json 的生命週期不同,所以分成兩個檔案.
- **`studio/progress.json`**: 由 Claude 寫入,記錄 Build 時每顆鏡頭的狀態和 stills 路徑,不寫進 storyboard.json,避免 SSOT 一直變動、git diff 也很亂.
- **`brief.md`**: 開頭標明 "generated from storyboard.json",手動修改會被覆蓋.Claude 一律改 storyboard.json,再用 uv script 重新產生.

選擇理由: 骨架讓網頁可以穩定地編輯時長、順序和技巧;自由文字保留好 brief 的細節;技巧欄位提供使用者想要的挑選體驗,但不把細節擠進固定格式.

## Impact

- storyboard.json schema (鏡頭骨架、技巧欄位、自由文字、上層的 brief 區塊).
- 新增 treatments.json 和 progress.json 的 schema.
- 產生 brief.md 的 uv script 要加上檔頭,並依 brief 範本輸出;技巧欄位要轉成文字寫進 `<structure>`.
- studio: 解析 INDEX.md、技巧挑選器、技巧檔檢視器、鏡頭卡片編輯器.
- SKILL.md / `treatments.md` / `shot-design.md`: 改成寫入 treatments.json,以及在分鏡中填好四個主技巧欄位.

## Alternatives

- **細粒度結構化 (技巧庫做成列舉值,取代文字)**: 網頁編輯最方便,但會逼 Claude 把細節塞進固定格式,遺失時間點和情緒的描述.不採用,改成「技巧欄位 + 自由文字」並存.
- **只有四個主欄位**: 介面最簡單,但其他類別的技巧只能寫在文字裡.不採用.
- **13 個類別各一個欄位**: 最完整,但鏡頭卡片會太長,大部分欄位也是空的.不採用.
- **使用者自己同步技巧和文字**: 不依賴 Claude,但容易漏改,使用者也不一定寫得出時間點細節.不採用.
- **產生器偵測 brief.md 手改並拒絕覆蓋**: 比較安全,但多一個合併流程.不採用.
- **treatments 放在 storyboard.json 裡**: 只有一個檔案,但會混進不用的方案,SSOT 不夠單純.不採用.
- **鏡頭狀態寫在 storyboard.json**: 欄位集中,但 Build 時會一直改動 SSOT.不採用,改用 progress.json.

## Follow-up

1. 寫出 storyboard.json、treatments.json、progress.json 的 JSON schema.
2. 實作 INDEX.md 解析 (類別、名稱、摘要、路徑).
3. 實作產生 brief.md 的 uv script (檔頭、技巧轉文字).
4. 更新 SKILL.md、`treatments.md`、`shot-design.md`、`brief-template.md`.

## Related Changes

## Decision Process

**Q:** storyboard.json 每顆鏡頭的欄位要結構化到什麼程度?

結構化骨架 + 自由文字內容,但希望網頁上能挑選鏡頭大小、角度、運鏡、轉場等技巧資訊.

**Q:** 網頁上要開放哪些技巧類別?

四個主欄位單選,其他類別用多選標籤.

**Q:** 技巧欄位跟自由文字不一致時以哪個為準?

技巧欄位代表意圖,由 Claude 同步文字和程式碼.

**Q:** brief.md 被手動修改怎麼辦?

檔頭標明自動產生,手改會被覆蓋.

**Q:** 三個 Treatment 方案要存在哪裡?

獨立的 treatments.json,選定後保留紀錄.

**Q:** (重述確認) 執行時解析 INDEX.md、進度拆到 progress.json?

正確.
