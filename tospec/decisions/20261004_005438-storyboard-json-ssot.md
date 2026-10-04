# storyboard.json 作為兩種模式共用的分鏡 SSOT

## Status

- proposed
- Date: 20261004_005438

## Context

現在每顆鏡頭的資訊 (時間、畫面、用途、運鏡、轉場、音效) 寫在 `brief.md` 的 `<structure>` 區塊裡,而且是散文格式 (參考 `video/lunelle-promo/brief.md`).web studio 要能逐顆鏡頭顯示和編輯欄位,但從散文解析或回寫都很脆弱,欄位也不固定.`audio/sfx/plan.json` 已經是結構化的 cue 陣列,可以當作先例.

CLI 模式要保留 (web 是選用的),而 CLI 使用者沒有 Node,所以 brief.md 不能靠 studio (Node) 產生.

## Decision

- `video/<slug>/storyboard.json` 是分鏡和 brief 內容的 SSOT,**CLI 和 web 兩種模式都一樣**.
- `brief.md` 由 uv script 從 storyboard.json 產生,仍然可以當作可重複使用的 prompt.
- studio 只列出有 storyboard.json **或** 有 `studio/intake.json` 的專案 (剛從網頁送出 Intake、還沒有分鏡的專案也要顯示,見 `20261004_013430-studio-state-file-layout.md`).兩者都沒有的舊專案 (例如 lunelle-promo) 不顯示,也不轉換.

選擇理由: 專案格式只有一種,所以 CLI 做的專案也能在 studio 完整編輯;uv script 讓 CLI 使用者不需要裝 Node.

## Impact

- 新增 storyboard.json schema (涵蓋 brief 的 inputs、direction、structure 以及 shots[]).
- 新增 `skills/cinematic-video/scripts/` 下用來產生 brief.md 的 uv script.
- `SKILL.md` Step 4 (Brief) 改成先寫 storyboard.json 再產生 brief.md;`references/brief-template.md` 要跟著調整.
- studio 讀寫 storyboard.json;Build 階段每顆鏡頭的狀態由 Claude 寫在 `studio/progress.json`,不寫進 storyboard.json (見 `20261004_014759-storyboard-schema-technique-slots.md`).

## Alternatives

- **維持 brief.md 為主,web 解析後回寫**: 改動最少,但回寫散文容易弄壞格式,欄位也不固定.不採用.
- **只有 web 模式用 storyboard.json**: CLI 完全不用改,但會有兩種專案格式並存,CLI 做的專案在 studio 裡只能唯讀.不採用.

## Follow-up

1. 定義 storyboard.json schema (欄位結構見 `20261004_014759-storyboard-schema-technique-slots.md`;Build 進度另外放在 progress.json).
2. 實作產生 brief.md 的 uv script,輸出結構對齊現有的 brief-template.
3. 更新 SKILL.md 和 brief-template.md.

## Related Changes

## Decision Process

**Q:** 每顆鏡頭資訊的 SSOT 要放在哪裡?

結構化的 storyboard.json,brief.md 由它產生.

**Q:** CLI 模式也要用 storyboard.json 嗎?

兩種模式都以 storyboard.json 為準,用 uv script 產生 brief.md.

**Q:** 沒有 storyboard.json 的舊專案要怎麼顯示?

不顯示舊專案.
