# SKILL.md 精簡改寫與 mod 的 gate 防護

## Status

- proposed
- Date: 20261004_021550

## Context

`SKILL.md:95` 寫明「This is the only approval gate. After it, build without asking」.web 模式要求每個階段都停下來,但模型可能照 SKILL.md 原本的習慣一路做到底,跳過 gate.協定是由 mod 的 `prompt.compose` 注入的 (`20261004_012329-studio-mod-bridge.md`),而全域的舊版 SKILL.md 可能會蓋過 workspace 的副本.

mod 的 `tool.call` hook 可以回傳 `{ deny }` 擋下工具呼叫,也可以在呼叫結束後做事 (plugin-authoring 說明).但如果要用字串比對辨識所有「下一階段的動作」,規則會很脆弱.

兩種模式都要改的部分: Step 2 要寫 `treatments.json` (`20261004_014759-storyboard-schema-technique-slots.md`),Step 4 改成寫 storyboard.json 再產生 brief.md (`20261004_005438-storyboard-json-ssot.md`).

## Decision

**SKILL.md 精簡改寫**:
- 只補上兩種模式共用的變更 (寫 treatments.json;先寫 storyboard.json 再產生 brief.md),再加一句「有載入 studio mod 時,照 mod 的規則」.
- gate payload、progress.json、render 進度參數這些 web 協定只在 web 模式需要,全部由 mod 注入,不寫進 SKILL.md.
- SKILL.md 不會因此變長,協定也跟著 mod 的版本走.

**gate 防護**:
- mod 只擋**昂貴、而且能明確辨識**的關鍵動作.v1 的清單: 「Build 精修」gate 還沒核准時,擋下整片的高畫質 render (render.py 輸出到 `out/` 的完整影片).被擋時的 deny 訊息會告訴 Claude 先開 gate.如果該 gate 設成 auto-continue,就視為已經核准.
- 其他階段靠協定處理.studio 如果發現有新的產出,階段卻超過最後一個核准的 gate,就在網頁上顯示警告.
- CLI 模式沒有 mod,所以不會有任何阻擋.

選擇理由: 最需要防的是「白白浪費一次很久的 render」,而這個動作很容易精確辨識;其他階段用字串比對很容易誤擋,所以交給協定和警告.

## Impact

- SKILL.md: Step 2 和 Step 4 的修改,以及模式說明.
- mod: `tool.call` 對 render.py 的判斷與 deny;`prompt.compose` 的協定內容.
- studio: 偵測「產出超過已核准的階段」並顯示警告.

## Alternatives

- **只靠協定和警告,不擋**: 不會誤擋,但可能白白耗掉一次很久的 render.不採用.
- **盡量強制擋下每個階段**: 最嚴格,但字串比對的規則很脆弱、容易誤擋,維護成本也高.不採用.
- **SKILL.md 寫完整的兩套流程**: 規則都集中在一個地方,但 SKILL.md 會變很長;全域舊版蓋過副本時,協定也會跟著失效.不採用.

## Follow-up

1. 定義「整片高畫質 render」的判斷規則 (輸出路徑、是否為 `--still`、`--start`/`--duration` 部分 render 的處理).
2. 撰寫 mod 注入的協定文字.
3. 修改 SKILL.md、`treatments.md`、`brief-template.md`.
4. studio 實作「超過已核准階段」的偵測.

## Related Changes

## Decision Process

**Q:** Claude 沒停在 gate 就往下做時,要防護到什麼程度?

只擋昂貴的關鍵動作,其餘靠協定加警告.

**Q:** SKILL.md 要怎麼改寫才能支援兩種模式?

只加精簡的模式說明,web 協定全部由 mod 注入.

**Q:** (重述確認) v1 擋下的動作清單是「Build 精修 gate 未核准時的整片高畫質 render」?

正確.
