# 時長編輯: 存時長、網頁自動順延、plan.json 平移與重新對齊標記

## Status

- proposed
- Date: 20261004_021551

## Context

在剪輯軟體式的時間軸上修改鏡頭時長,會產生連鎖效應: 後面的鏡頭會位移,總長會偏離規格,鏡頭也會偏離拍點 (例如 lunelle 的 84 BPM),SFX cue 的時間全部對不上.另外,剪接過的配樂原本是對齊畫面的 (lunelle 的 groove 剛好落在 5.714 秒的送出動作上),總長一改就失效.

查證到的事實:
- `plan.json` 每一筆是位置固定的陣列 `[name, time, gain, note, floor?, cap?]`,只有絕對時間,沒有標示屬於哪一顆鏡頭;`audio_tools mix` 依照這個格式解析,不能隨意加欄位.
- 路徑不一致: SKILL.md 和 `audio_tools mix` 的範例寫 `audio/plan.json`,但 lunelle 實際放在 `audio/sfx/plan.json`.
- 原本的決定是 v1 音訊唯讀 (`20261004_005439-web-mode-stage-gates.md`).

使用者選擇讓網頁自動順延 (總長跟著改變),並且要求 plan.json 正確反映修改後的時間.

## Decision

- **storyboard.json 存每顆鏡頭的時長**,起訖時間依照順序推算.產生 brief.md 時,再換算成絕對時間.
- **在 gate 修改時長時,網頁自動讓後面的鏡頭順延**,總長也跟著改變.
- **`audio/plan.json` 的處理**:
  - cue 歸屬於「起點 ≤ cue 時間 < 終點」的那顆鏡頭.
  - 後面鏡頭的 cue 精確平移 Δ.
  - 被改鏡頭內的 cue 維持原位,並在 gate 回覆的改動清單中標成「需要重新對齊」.這個標記**不寫進 plan.json**,以維持 `audio_tools` 的格式.
- **配樂**: 改動清單加上「配樂需要重新剪接」.網頁不動任何音訊檔.
- 回覆送出後,由 Claude 重新對齊 cue、重剪配樂、重新混音,並更新程式碼和文字裡的時間點.
- **plan.json 路徑統一為 `audio/plan.json`**.
- **雙寫入者例外**: plan.json 跟 storyboard.json 一樣,Claude 在工作時寫入,網頁只在 gate 時寫入,兩邊靠 gate 狀態錯開時間.手動編輯音效仍然延到 v2.

選擇理由: 「能證明正確的才自動做」.後面鏡頭的 cue 平移一定正確,鏡頭內的 cue 和配樂沒有唯一的正確答案,交給能看懂畫面動作的 Claude.存時長的話,順延只需要改一個欄位,也不會出現鏡頭重疊或空隙.

## Impact

- storyboard.json schema: 鏡頭時間改成存時長 (更新 `20261004_014759-storyboard-schema-technique-slots.md` 的描述).
- studio: 順延邏輯、plan.json cue 的平移、改動清單 (重新對齊、配樂重剪).
- SKILL.md 和 `audio.md`: plan.json 路徑統一為 `audio/plan.json`.
- mod 注入的協定: 收到改動清單後,Claude 要做哪些同步.

## Alternatives

- **時長只記為意圖,網頁不搬動其他鏡頭**: 規則最單純,但使用者在網頁上看不到修改後的結果.使用者選擇讓網頁自動順延.
- **拖曳時吸附 beat grid,總長固定**: 最精緻,但實作最複雜,也不一定符合創意意圖.不採用.
- **鏡頭內的 cue 依比例縮放**: 不需要 Claude,但不一定對得上畫面的動作.不採用.
- **鏡頭內的 cue 維持相對鏡頭開頭的位置**: 跟開頭有關的音效會正確,但結尾的轉場音效會對不上.不採用.
- **有配樂剪接時,修改前先警告**: 多一道確認,後續仍然要 Claude 重剪.不採用,直接標示在改動清單.
- **存絕對起訖時間**: 跟現在 brief 的寫法一致,但每次修改都要重寫後面所有鏡頭,也可能出現重疊.不採用.
- **plan.json 路徑寫在 storyboard.json 裡**: 比較有彈性,但多一個要維護的欄位.不採用.

## Follow-up

1. 實作順延和 cue 平移邏輯,並寫測試 (包含邊界上的 cue).
2. 定義改動清單的格式 (時長變更、需要重新對齊的 cue、配樂重剪).
3. 更新 SKILL.md 和 `audio.md` 的 plan.json 路徑.
4. 撰寫 mod 協定中的同步規則.

## Related Changes

## Decision Process

**Q:** 在網頁上改鏡頭時長時,連鎖調整要由誰處理?

網頁自動順延,總長跟著改變,並且要確保 plan.json 正確更新.

**Q:** 被改時長的鏡頭裡的 SFX cue 要怎麼處理?

標記為需要重新對齊,交給 Claude.

**Q:** 總長改變後,剪接過的配樂怎麼辦?

網頁標示「配樂需要重新剪接」,由 Claude 重剪並重新混音.

**Q:** 鏡頭時間要怎麼存?

存每顆鏡頭的時長,起訖時間由順序推算.

**Q:** plan.json 的位置要統一成哪一個?

統一為 `audio/plan.json`.

**Q:** (重述確認) cue 的歸屬規則是「起點 ≤ cue 時間 < 終點」?

正確.
