# web 模式各階段 gate 的顯示內容與回覆類型

## Status

- proposed
- Date: 20261004_014800

## Context

`20261004_005439-web-mode-stage-gates.md` 決定了 web 模式要停在哪些 gate,但沒有定義每個 gate 在網頁上顯示什麼、使用者可以怎麼回覆.第三輪 grill 對照 skill 現有文件,整理出各階段的實際產出:

- Treatments: `treatments.md` 的方案範本,以及 style frame / motion test.
- 分鏡: storyboard critic 報告 (`gauntlet.md` 的 Storyboard round).
- Assets: asset critic 報告和 generation ledger (`code-stack.md`).
- Build: 每顆鏡頭的 stills、960×540 animatic、component critic 報告 (SKILL.md Step 6).
- Audio: `plan.json` 和 loudness 量測 (`audio.md`).
- Gauntlet: 5 種 round,`qa/review_log.md` 的表格,以及 frozen time 和 loudness 量測 (`gauntlet.md`).

## Decision

| Gate | 網頁顯示 | 可以回覆 |
|---|---|---|
| Intake | 表單: 草稿/prompt/想法、規格、profile、品牌、素材的**本機路徑**;Claude 的追問 (最多 3 題,附預設值) | 送出 / 回答追問 |
| Treatments | `treatments.json` 的 3 張方案卡,加上 style frame 或 motion test | 選一個 / 混搭 (勾選各方案的元素並附意見) / 全部重做 |
| 分鏡 | 鏡頭卡片 + storyboard critic 報告 | 核准 / 修改 (直接改欄位,並附每顆鏡頭的意見) |
| Assets (有素材才停) | 生成素材 gallery、asset critic 報告、generation ledger | 核准 / 個別重新生成 |
| Build animatic | animatic、每顆鏡頭的 stills、`render(t)` 預覽 | 核准 / 修改 (意見、時長;修改時長時網頁會自動順延,並產生改動清單) |
| Build 精修 | `render(t)` 預覽、stills、component critic 結果、render 時間估計 | 核准並開始高畫質 render / 修改 |
| Audio | 混音播放、`audio/plan.json` cue (不能手動編輯;修改鏡頭時長時會自動平移,見 `20261004_021551-timeline-duration-ripple.md`)、loudness 報告 | 核准 / 修改意見 |
| Gauntlet 每輪 | critic 重點、量測數據 (frozen time、loudness)、review_log | 再一輪 (可以指定優先項目) / 交片 |
| Deliver | final.mp4、poster、交付說明、待使用者確認的事實 | 結案 |

- **v1 只能修改目前階段**: 想回到前面的階段,就寫在意見裡 (例如「改用方案 B 的色調」),由 Claude 判斷要重做哪些,並在下一個 gate 說明改了什麼.gate 歷史維持一條直線.
- **Intake 只有文字 + 本機路徑**: 素材先放進資料夾,再在表單填路徑;上傳功能延到 v2.
- 所有回覆都會附上「這次在網頁上改了哪些欄位」,讓 Claude 知道要重新讀取哪些內容.

選擇理由: gate 的內容直接沿用 skill 現有的產出,不新增額外的製作工作.單線的 gate 歷史和純文字的 Intake 讓 v1 的範圍維持可控.

## Impact

- 每種 gate 的 payload schema (寫在 `gates/<gateId>.json`) 和 reply schema (寫在 `replies/<gateId>.json`).
- studio: 9 種 gate 面板,以及影片和音訊播放器.
- SKILL.md web 模式流程: 每個階段結束時要產出對應的 payload.
- Intake 表單.

## Alternatives

- **提供「回到階段 N」按鈕**: 比較直觀,但要處理後續產出失效和 gate 歷史分支.不採用,延到之後的版本.
- **v1 就支援拖放上傳**: 使用者體驗比較好,但要處理大檔案、檔名衝突和上傳 API 的防護.延到 v2.

## Follow-up

1. 定義 9 種 gate 的 payload schema 和 reply schema.
2. 實作各 gate 面板 (從分鏡和 Treatments 開始).
3. 更新 SKILL.md: 每個階段的 payload 要怎麼產出.
4. (v2) 上傳素材、回到前面階段.

## Related Changes

## Decision Process

**Q:** 網頁 Intake 要不要支援上傳檔案?

v1 只有文字 + 本機路徑,上傳延到 v2.

**Q:** 在某個 gate 想回到前面的階段時要怎麼處理?

v1 只能修改目前階段,要回頭就寫在意見裡.

**Q:** (重述確認) 各階段 gate 的顯示內容與回覆類型表是否正確?

正確.
