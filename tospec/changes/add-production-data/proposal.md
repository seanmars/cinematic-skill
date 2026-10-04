## Why

目前每顆鏡頭的資訊寫在 brief 的散文裡,三個 treatment 也只出現在對話中.不論是之後的 web studio,還是要在 CLI 與 studio 之間切換同一個專案,都需要結構化而且兩種模式共用的資料格式.這一塊不依賴 mod 或網頁,可以先做完,讓 CLI 模式直接受益,也是後續 add-studio-bridge 與 add-web-studio 的基礎.本 change 依據 ADR: storyboard-json-ssot、storyboard-schema-technique-slots、timeline-duration-ripple (時長儲存與 plan 路徑)、skill-md-and-gate-enforcement (SKILL.md 的共用變更)、v1-testing-strategy、project-custom-techniques (CLI 實測後新增).

## What Changes

- **新增 storyboard.json**: 兩種模式共用的分鏡 SSOT.鏡頭存時長 (起訖時間由順序推算),包含四個主技巧欄位 (鏡頭大小、角度、運鏡、轉場)、其他技巧標籤、素材引用與自由文字;上層對應 brief 範本的各個區塊.
- **新增 treatments.json**: 三個方案的結構化紀錄 (style frame 加上選填的 motion test),選定後內容寫入 storyboard.json,沒選的方案保留.
- **新增專案自訂技巧**: 技巧庫沒有的技巧,經網路查證或與使用者討論後,寫成專案內的自訂技巧檔 (格式同技巧庫並附來源),不修改 skill 的技巧庫.
- **新增 brief 產生器**: uv script,從 storyboard.json 產生 brief.md,檔頭標明是自動產生;引用的技巧檔在技巧庫與專案中都找不到時,以失敗結束.
- **新增 JSON Schema 與 fixture 專案**: fixture 放在 repo 根目錄,不隨 skill 散佈;用 pytest 驗證 fixture 符合 schema,並測試 brief 的產生.
- **修改 SKILL.md**: Step 2 改寫 treatments.json,Step 4 改成先寫 storyboard.json 再產生 brief.md.CLI 模式的 approval gate 不變.
- **修改參考文件**: brief 範本改成產生器的輸出規格;treatments 對應 treatments.json;shot-design 要求填好四個主技巧欄位,並說明新技巧的查證流程 (技巧庫 → 網路 → 詢問使用者);audio 把 SFX plan 統一放在 audio 目錄下,混音時明確指定音效目錄.

## Capabilities

### New Capabilities
- `production-data`: 專案資料格式與產生器 (storyboard.json、treatments.json、brief.md 產生、SFX plan 路徑、CLI 模式的流程變更) (maps to specs/production-data/spec.md)

### Modified Capabilities
- (無)

## Impact

- **skill**: 新增 schema 目錄與 brief 產生器;修改 SKILL.md、brief 範本、treatments、shot-design、audio 參考文件.render.py 與 audio_tools.py 的介面不變.
- **本 repo**: 新增 fixtures 與 pytest 測試 (透過 uv inline 執行,測試才需要 jsonschema 依賴).
- **使用者專案**: 新專案會多出 storyboard.json 與 treatments.json,brief.md 改成由產生器輸出.舊專案不受影響.
- **後續 change**: add-studio-bridge 與 add-web-studio 都依賴本 change 的資料格式.
