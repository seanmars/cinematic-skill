## Purpose

定義 CLI 與 web 兩種模式共用的專案資料格式與產生規則,讓同一個影片專案能在 terminal 與 studio 之間無損切換.

## ADDED Requirements

### Requirement: storyboard.json 是兩種模式共用的 SSOT
不論 CLI 或 web 模式,skill SHALL 把分鏡與 brief 內容寫入專案的 storyboard.json,並以它作為唯一的資料來源;每顆鏡頭 SHALL 包含 id、順序、時長、四個主技巧欄位 (鏡頭大小、角度、運鏡、轉場,可留空)、其他技巧標籤、素材引用,以及自由文字 (Picture、Job、Action、Camera、Audio、Transition);技巧欄位的值 SHALL 引用技巧庫或專案自訂技巧中的技巧檔.鏡頭的起訖時間 SHALL 由順序與時長推算,不另外儲存.

#### Scenario: CLI 模式完成分鏡
- **WHEN** 使用者在 CLI 模式完成 Brief 階段
- **THEN** 專案有符合 schema 的 storyboard.json,之後可以在 studio 中完整編輯

#### Scenario: 推算起訖時間
- **WHEN** 前三顆鏡頭的時長是 1.786、0.764、3.164 秒
- **THEN** 第三顆鏡頭的起點是 2.550 秒,終點是 5.714 秒

### Requirement: Claude 寫分鏡時填好主技巧欄位
寫入或修改分鏡時,Claude SHALL 為每顆鏡頭填好四個主技巧欄位 (無法對應時可留空);技巧欄位與自由文字不一致時,技巧欄位代表使用者的意圖,Claude SHALL 據此同步文字與程式碼.

#### Scenario: 新寫的分鏡
- **WHEN** Claude 依 shot-design 的指引完成分鏡
- **THEN** 每顆鏡頭的四個主技巧欄位都有值或明確留空

### Requirement: 新技巧寫成專案自訂技巧檔
需要技巧庫沒有的技巧時,Claude SHALL 先上網查證;查得到時 SHALL 把它寫成專案 techniques 目錄下的自訂技巧檔 (路徑為 `<category>/<slug>.md`,category 為技巧庫既有的類別,格式同技巧庫,並記錄來源);網路上也查不到時,Claude SHALL 先詢問使用者並討論實際的做法,再寫成自訂技巧檔 (來源標為使用者).Claude SHALL NOT 修改 skill 的技巧庫.

#### Scenario: 網路查得到的新技巧
- **WHEN** 分鏡需要一個技巧庫沒有、但網路上有說明的技巧
- **THEN** 專案出現該技巧的自訂技巧檔,內容包含名稱、類別、做法與來源網址
- **AND** storyboard 引用該檔,skill 的技巧庫沒有變動

#### Scenario: 網路查不到的技巧
- **WHEN** 分鏡需要一個網路上也查不到的技巧
- **THEN** Claude 先詢問使用者並討論做法,之後才寫入自訂技巧檔,來源標為使用者

### Requirement: Treatments 寫入 treatments.json
兩種模式下,skill SHALL 把三個 treatment 寫入專案的 treatments.json,欄位對應 treatment 範本 (標題、logline、Look 與色票、規格、stack、shot breakdown、signature moves、audio、估時與風險、why it fits、style frame 路徑,以及選填的 motion test 路徑);選定後,選定內容 SHALL 寫入 storyboard.json,沒選的方案 SHALL 保留在 treatments.json 作為紀錄.

#### Scenario: 選定方案 B
- **WHEN** 使用者選定方案 B
- **THEN** storyboard.json 的 brief 內容來自方案 B,treatments.json 仍保留 A、B、C 三個方案

### Requirement: brief.md 由 storyboard.json 產生
brief.md SHALL 由 uv script 從 storyboard.json 產生,結構符合 brief 範本,鏡頭時間以推算出的絕對時間呈現,技巧欄位轉成文字;檔案開頭 SHALL 標明是從 storyboard.json 自動產生,手動修改會被覆蓋.Claude SHALL 只修改 storyboard.json,再重新產生 brief.md.brief.py SHALL 依序在技巧庫與專案自訂技巧中尋找引用的技巧檔;任何一個都找不到時,SHALL 列出所有找不到的路徑並以失敗結束,不寫入 brief.md.

#### Scenario: 路徑打錯字
- **WHEN** storyboard 的某個技巧欄位寫成不存在的 `camera-movement/push-inn.md`
- **THEN** brief.py 以失敗結束,訊息列出這個路徑並說明新技巧的查證流程
- **AND** 原本的 brief.md 沒有被覆寫

#### Scenario: 引用專案自訂技巧
- **WHEN** storyboard 引用的技巧檔只存在於專案的 techniques 目錄
- **THEN** brief.py 成功產生 brief.md,技巧名稱取自該自訂技巧檔

#### Scenario: 重新產生
- **WHEN** storyboard.json 中某顆鏡頭的時長改變並重新產生 brief.md
- **THEN** brief.md 中該鏡頭與之後所有鏡頭的時間範圍都反映新的時長
- **AND** 檔頭仍標明是自動產生

#### Scenario: 產生的 brief 可以當作 prompt
- **WHEN** 使用者把產生的 brief.md 拿到另一個工具使用
- **THEN** brief.md 包含範本的所有區塊,沒有未填的佔位符

### Requirement: SFX plan 的固定位置
skill SHALL 把 SFX plan 放在專案 audio 目錄下的 plan.json;混音時 SHALL 明確指定音效檔所在的目錄,讓 plan 與音效檔可以放在不同目錄.

#### Scenario: 混音
- **WHEN** Claude 在 Audio 階段執行混音
- **THEN** 混音使用 audio 目錄下的 plan.json,並找到音效目錄中的音效檔

### Requirement: CLI 模式的 approval gate 維持不變
CLI 模式 SHALL 維持只有 Treatments 一個 approval gate 的流程;本 change 對 CLI 模式的影響 SHALL 只限於改寫 treatments.json、storyboard.json 與產生 brief.md.

#### Scenario: CLI 模式核准方案後
- **WHEN** 使用者在 CLI 模式核准 treatment
- **THEN** Claude 自主完成後續所有階段,不在每個階段停下來詢問
