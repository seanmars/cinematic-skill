# Design: add-production-data

## Context

- skill 目前只有 Python 工具鏈,`scripts/` 的腳本都用 uv inline 宣告依賴;repo 沒有任何測試,也沒有 pyproject.
- `brief-template.md` 定義了 `<role>`、`<inputs>`、`<direction>`、`<structure>`、`<build>`、`<gotchas>`、`<start>` 這幾個區塊.實際寫得好的 brief (lunelle) 會把運鏡、時間點和情緒寫在一大段 Picture 文字裡,沒有完全照範本的欄位.
- `treatments.md` 的方案範本只在對話中使用,沒有存成檔案.
- 技巧庫的路徑格式是 `references/techniques/<category>/<slug>.md`.
- `audio_tools.py mix` 的 `--sfx-dir` 預設是 plan 所在的目錄;說明文件中的範例是 `--plan sfx/plan.json`,SKILL.md 寫的是 `audio/plan.json`,lunelle 則是 `audio/sfx/plan.json`.
- repo 的 `.gitignore` 會排除 `lib/`、`build/`、`dist/`、`out` 等目錄名稱 (見 add-studio-bridge 的檢查).本 change 新增的目錄 (`schema/`、`fixtures/`、`tests/`) 都不在排除範圍內.

## Goals / Non-Goals

**Goals:**
- 讓 CLI 模式也輸出結構化資料,同一個專案之後可以直接在 studio 中編輯.
- brief 產生器零依賴,CLI 使用者不需要安裝任何新工具.

**Non-Goals:**
- 不轉換舊專案.
- 不在執行時做 schema 驗證 (只在測試中驗證).brief.py 只檢查技巧路徑 (D4).
- 不把專案自訂技巧收進 skill 的技巧庫.
- CLI 實測 (`video/morning-steam`) 回報的既有 skill 問題,本 change 不處理,之後另開 change.這些問題包括: 10 秒片的鏡頭數、Routing 表漏列 shot-design 與 motion-grammar、平面畫作的 push in 與 parallax 互相矛盾、storyboard 和 component critic 跟 profile 表的矛盾、normalize 會壓縮 LRA、內建 SFX 種類不足、只重新 render 受影響秒數的限制、quality bar 與只跑一輪的衝突、critic 改動已核准內容時是否要重新取得同意.

## Decisions

### D1: schema 放在 skill 層級的 `schema/`
storyboard 與 treatments 的 JSON Schema 放在 skill 根目錄的 `schema/`,隨 skill 散佈.Claude 寫檔時可以參考,之後的 studio 和測試也會使用.

- **Why**: schema 是兩種模式共用的契約,不屬於 studio;放在 skill 根目錄,CLI 模式也看得到.
- **Alternative (rejected)**: 放在 `studio/schema/`.CLI 模式用不到 studio,卻要依賴它的目錄.

### D2: storyboard 的形狀
上層對應 brief 範本: `inputs` (Topic、Key takeaway、Profile、Business、CTA、Provably true、Never claim、Source、Real assets、Specs、Brand、Audio,都是文字)、`direction` (Look、Pacing、Persistent actor、Camera、Signature moves、Avoid)、`beatGrid`、`build`、`gotchas`、`renderRoot` (選填),以及 `shots`.每顆鏡頭的結構如下 (取自 schema 草案,只保留決策重點):

```json
{ "id": "s3", "duration": 3.164,
  "techniques": { "framing": "framing/insert.md", "angle": null,
                  "movement": "camera-movement/push-in.md", "transition": "editing/match-cut.md" },
  "tags": ["lighting/rim-light.md"], "assets": [],
  "text": { "picture": "...", "job": "...", "action": "...", "camera": "...", "audio": "...", "transition": "..." } }
```

- **Why**: 時間、技巧、素材用結構化欄位,網頁可以穩定地編輯;內容用自由文字,保留好 brief 的細節.存時長而不是絕對時間,可以避免順延時重寫後面所有鏡頭.

### D3: treatments.json 的形狀
`{ "options": [ {id, title, logline, look:{description, palette[], typefaces[]}, specs, stack, cta?, shots:[{range, text}], signatureMoves[], audio, estimate, risk, whyItFits, preview, motionTest?} ], "chosen": null | {id, mix?, notes?} }`.選定後,由 Claude 把內容展開寫進 storyboard.json.

- `preview` 是 style frame,`motionTest` 是選填的 2–4 秒 motion test,對應 SKILL.md Step 3 的兩種產出 (CLI 實測發現單一欄位放不下兩者).
- `estimate` 只寫 render 時間,`risk` 是另一個欄位.estimate 在 Step 2 先粗估,Step 3 量完每格的時間後再更新.

### D4: brief.py 的輸出規則
`scripts/brief.py <project-dir>` 讀取 storyboard.json,寫出 brief.md:
- 第一行是 `<!-- generated from storyboard.json; edits will be overwritten -->`.
- 區塊依範本順序輸出.
- 鏡頭標題寫成 `Shot n | start–end`,時間由時長累加,取到小數 3 位.
- 技巧欄位轉成 `Shot: <framing 名稱>, <angle 名稱>` 和 `Camera: <movement 名稱>; <camera 文字>` 等行.名稱優先取自技巧檔 frontmatter 的 `name`,其次是第一個標題.
- **技巧檔的查找順序**: 先找 skill 技巧庫 `references/techniques/<path>`,再找專案的 `techniques/<path>` (D7).寫檔之前先檢查所有引用的路徑;只要有任何一個兩處都找不到,就列出全部找不到的路徑並以失敗結束,不寫入 brief.md.錯誤訊息會提示查證流程.這取代了原本「讀不到就用 slug」的 fallback (`20261004_113314-project-custom-techniques.md`):CLI 實測發現,fallback 會把打錯字和編出來的技巧悄悄變成合理的名稱.
- `<build>` 與 `<start>` 的固定文字沿用範本.

- **Why**: 輸出結構跟原本的 brief 一樣,所以 brief.md 可以繼續當作「可以拿到其他工具使用的 prompt」.
- **Trade-off**: 範本的固定文字會同時存在範本文件和產生器裡,所以要用測試確認兩者一致.

### D5: SFX plan 路徑
新專案一律使用 `audio/plan.json`,音效檔放在 `audio/sfx/`,混音指令改成 `--plan audio/plan.json --sfx-dir audio/sfx`.`audio_tools.py` 的參數介面不變,只更新說明中的範例.

### D6: 參考文件的修改範圍
- SKILL.md: Step 2 (寫入 treatments.json)、Step 4 (先寫 storyboard.json,再執行 brief.py),以及 Project Directory 表 (新增 storyboard.json 與 treatments.json).
- `brief-template.md`: 說明它是 brief.py 的輸出規格,並列出 storyboard 欄位與 brief 區塊的對應關係.
- `treatments.md`: 對應 treatments.json 的欄位.
- `shot-design.md`: 每顆鏡頭要填四個主技巧欄位.
- `audio.md`: 改用 D5 的路徑.

模式說明 (「有載入 studio mod 時,照 mod 的規則」) 不在本 change 的範圍,屬於 add-studio-bridge.

CLI 實測後補上的措辭修正 (屬於本 change 寫的文件):
- `treatments.md`: estimate 與 risk 分開,estimate 先估後更新;`motionTest` 欄位.
- `shot-design.md`: 沒有 cut (例如連續長鏡頭) 時,transition 留 null;新技巧的查證流程 (D7).
- `brief-template.md`: 刻意的 holds 和「使用者沒指定、採用預設值」的項目,寫在 `direction.pacing` 等文字欄位;`renderRoot` 不會出現在 brief 中,只用在 render.py 需要 `--root` 時.
- SKILL.md Step 4: 新技巧的查證流程一句,並指向 shot-design.md.

### D7: 專案自訂技巧檔
技巧庫沒有的技巧,寫成 `video/<slug>/techniques/<category>/<slug>.md`.格式和技巧庫相同:
- frontmatter 包含 `name`、`category`、`slug`、`source` (網址,或 `user`).
- 內容包含 `# <name>`、`Summary:`、`## How It Works`.

category 必須是技巧庫既有的類別之一,所以 storyboard 的路徑寫法和四個主欄位的類別限制都不變.

查證流程 (寫在 shot-design.md):
1. 先在 INDEX.md 搜尋,確認不是名稱不同的既有技巧.
2. 上網查證.查得到就寫成自訂技巧檔,並記錄來源網址.
3. 查不到就詢問使用者,討論實際的做法後再寫,`source: user`.

skill 的技巧庫不修改.

- **Why**: 新技巧必須有一份說明檔才算存在,打錯字就會被 D4 擋下;critic 和之後的 studio 技巧選擇器,也能用同樣的方式讀取新技巧.
- **Alternative (rejected)**: 欄位直接寫 `{ name, source }`.沒有做法說明,打錯字也抓不到.

## Testing Seams

接縫在 **brief.py 的檔案輸入與輸出**.pytest (uv inline,測試檔宣告 `jsonschema` 依賴) 以 `fixtures/demo/storyboard.json` 為輸入,執行 brief.py,斷言輸出的區塊、時間範圍、檔頭與技巧文字.另外也要涵蓋: 技巧路徑找不到時以失敗結束而且不覆寫 brief.md、專案自訂技巧能被找到 (用暫存的專案副本建立 `techniques/` 檔案).同一個測試檔也驗證 `fixtures/demo/` 的 storyboard 與 treatments 符合 `schema/`,以及範本文件中的固定文字跟產生器一致.

「Claude 寫分鏡時填好主技巧欄位」「選定方案 B」「CLI 模式核准方案後」這三項屬於模型行為,沒辦法寫自動化測試,改用一次 CLI 模式的實際製作來驗證.

## Migration Plan

- 舊專案不轉換;它們的 brief.md 仍然是手寫的,混音時繼續用原本的 plan 路徑和指令.
- 新專案從本 change 之後開始,會產生 storyboard.json、treatments.json,brief.md 改由產生器輸出.
- CLI 模式的 gate 流程不變.

## Risks / Trade-offs

- **範本固定文字重複**: 範本文件和產生器各有一份,靠測試確保一致.
- **模型行為**: Claude 是否確實填好技巧欄位、確實先寫 storyboard 再產生 brief,只能靠 SKILL.md 的指示加上實際製作驗證.CLI 實測 (`video/morning-steam`) 顯示這幾項都有做到.
- **新技巧的查證品質**: 網路查證的內容正不正確,只能靠來源網址讓使用者確認;沒有網路搜尋工具時,流程就直接進入詢問使用者.
- **schema 演進**: 之後如果修改 schema,舊專案的 storyboard 可能不再符合.本 change 沒有 schemaVersion 和遷移機制 (Non-Goal).

## Open Questions

- (無)
