# gate 回覆的結構化選擇: reply 新增選填的 choice 物件

## Status

- accepted
- Date: 20261004_161115
- 擴充 `20261004_014800-web-gate-payloads.md`: 補上「回覆要記錄哪些選擇」的位置.

## Context

`20261004_014800-web-gate-payloads.md` 定義了各 gate 可以怎麼回覆: Treatments 可以選一個、混搭 (勾選各方案的元素) 或全部重做;Gauntlet 可以再一輪並指定優先項目;Assets 可以個別重新生成.add-web-studio 的 spec 也要求「回覆記錄混搭的元素與意見」「回覆記錄再一輪與優先項目」.

實作 add-web-studio 的 slice 7 時發現:
- `schema/reply.schema.json` 只有 `decision`、`notes`、`changes`,而且 `additionalProperties: false`,沒有地方放「選了哪個方案、混搭哪些元素、優先處理哪些項目」.
- `changes` 的意思是「使用者在網頁上改了哪些欄位」,讓 Claude 知道要重新讀取哪些檔案,不適合拿來放選擇.
- `treatments.schema.json` 已經有 `chosen: { id, mix: [{ option, element }], notes }`,SKILL.md 規定由 Claude 把選擇記錄進 `treatments.json`.
- `20261004_013430-studio-state-file-layout.md` 規定一個檔案一個寫入者,目前只有 storyboard.json 和 audio/plan.json 是雙寫入者的例外.

## Decision

**reply 新增選填的 `choice` 物件,形狀依 gate 的階段而定**:

| 階段 | decision | choice |
|---|---|---|
| Treatments | `pick` | `{ "id": "B" }` |
| Treatments | `mix` | `{ "id": "A", "mix": [{ "option": "C", "element": "structure" }] }` (形狀同 treatments.json 的 `chosen`) |
| Gauntlet | `another-round` | `{ "priorities": ["..."] }` (可以省略) |
| Assets | `regenerate` | `{ "regenerate": ["<asset path>", ...] }` |

- 其他 decision 不帶 `choice`.studio 依階段與 decision 驗證 `choice` 的形狀,不符就拒絕寫入.
- mod 的喚醒訊息在 `decision`、`notes`、`changes` 之後,加上一行 `choice: <JSON>`.
- `treatments.json` 的 `chosen` 仍由 Claude 依 SKILL.md 寫入,studio 不寫 treatments.json,單一寫入者的規則不變.

選擇理由: 結構化的欄位讓 Claude 不必解析自由文字;放在 reply 裡,選擇跟著 gate 歷史一起進 git,也不會新增雙寫入者的檔案.

## Impact

- `schema/reply.schema.json`: 新增選填的 `choice`,以及 tests/test_schema.py 的範例.
- studio: reply API 依階段驗證 decision 與 choice;Treatments、Gauntlet、Assets 面板送出 choice.
- mod: 喚醒訊息帶出 choice.
- add-web-studio 的 design D3 (reply 的寫入) 要補上 choice.

## Alternatives

- **在 notes 寫結構化文字** (例如 `pick: B`、`mix: A + C.structure`): 不用改 schema 和 mod,但 Claude 要解析自由文字,容易誤讀,使用者自己寫的意見也可能跟格式混在一起.不採用.
- **studio 在 Treatments gate 直接寫 treatments.json 的 `chosen`**,並在 changes 列出 `treatments.chosen`: 跟分鏡欄位的編輯方式一致,但 treatments.json 會變成第三個雙寫入者的檔案,Gauntlet 和 Assets 的選擇仍然沒有地方放.不採用.

## Follow-up

1. 更新 reply.schema 與 schema 測試範例.
2. 實作 studio 依階段驗證 decision 與 choice,以及 mod 喚醒訊息帶出 choice (含測試).
3. 實作 Treatments、Gauntlet、Assets 面板送出 choice.
4. 更新 add-web-studio 的 design D3.

## Related Changes

## Decision Process

**Q:** gate 回覆要把結構化的選擇 (Treatments 的選定與混搭元素、Gauntlet 的優先項目、要重新生成的素材) 記錄在哪裡?

選填的 reply 欄位: reply.schema 新增依階段而定的 `choice`,mod 喚醒時以 JSON 帶給 Claude,treatments.json 的 chosen 仍由 Claude 寫入.
