# Tasks: add-production-data

## 1. schema、fixture 與 schema 驗證
- [x] 1.1 寫一個會失敗的 pytest (uv inline,宣告 jsonschema 依賴): `fixtures/demo/` 的 storyboard.json 與 treatments.json 符合 `schema/`
- [x] 1.2 依 D2 與 D3 建立 `schema/storyboard.schema.json` 和 `schema/treatments.schema.json`,並建立 `fixtures/demo/` (storyboard、treatments、`audio/plan.json`、一個簡單的 `render(t)` index.html),直到測試通過
- [x] 1.3 確認 fixture 的時長資料能涵蓋「推算起訖時間」scenario (1.786、0.764、3.164 秒)

## 2. brief 產生器
- [x] 2.1 寫會失敗的 pytest: 「推算起訖時間」「重新產生」(修改時長後時間範圍更新、檔頭仍在)「產生的 brief 可以當作 prompt」(所有區塊都有、沒有佔位符)、技巧欄位轉成文字、範本固定文字與產生器一致
- [x] 2.2 實作 `scripts/brief.py` (uv inline,不需要依賴),依 D4 輸出,直到測試通過
- [x] 2.3 用 fixture 實際執行一次,檢查 brief.md 的可讀性和範本是否一致

## 3. SKILL.md 與參考文件
- [x] 3.1 修改 SKILL.md: Step 2 寫入 treatments.json,Step 4 先寫 storyboard.json 再執行 brief.py,Project Directory 表新增這兩個檔案 (D6)
- [x] 3.2 修改 `brief-template.md` (產生器輸出規格與欄位對應)、`treatments.md` (對應 treatments.json)、`shot-design.md` (四個主技巧欄位)
- [x] 3.3 修改 `audio.md` 與 `audio_tools.py` 說明中的範例,改用 `--plan audio/plan.json --sfx-dir audio/sfx` (D5)
- [x] 3.4 用 fixture 的音效檔執行一次 `audio_tools.py mix`,驗證「混音」scenario

## 4. CLI 模式實際驗證
- [x] 4.1 在 CLI 模式製作一支短片 (stylized,約 10 秒),確認「CLI 模式完成分鏡」「新寫的分鏡」「選定方案 B」(選一個非 A 的方案)「CLI 模式核准方案後」
- [x] 4.2 依 CLI 實測的回報修正本 change 寫的文件措辭 (design D6): `treatments.md` 的 estimate 與 risk 分開、estimate 先估後更新;`shot-design.md` 寫明沒有 cut 時 transition 留 null;`brief-template.md` 說明 holds、預設值與 `renderRoot` 該寫在哪裡.修正後用 `video/morning-steam` 重新產生 brief,並逐項確認回報的問題 #3、#4、#6、#8、#10 都有對應的說明

## 5. 專案自訂技巧與 brief.py 的路徑檢查
- [x] 5.1 寫會失敗的 pytest: 「路徑打錯字」(以失敗結束、列出路徑、不覆寫原本的 brief.md)、「引用專案自訂技巧」(名稱取自專案的 `techniques/` 檔案)
- [x] 5.2 依 D4 實作 brief.py 的查找順序 (技巧庫 → 專案) 與失敗處理,直到測試通過;更新 storyboard schema 的欄位描述
- [x] 5.3 在 `shot-design.md` 加上新技巧的查證流程與自訂技巧檔格式 (D7),並在 SKILL.md Step 4 加一句指向它
- [x] 5.4 對照「網路查得到的新技巧」「網路查不到的技巧」,確認文件中的流程足以讓 Claude 照做 (網路搜尋 → 寫檔附來源;查不到就先詢問使用者)

## 6. treatments 的 motion test 欄位
- [x] 6.1 寫會失敗的 pytest: fixture 的 treatments 帶有 `motionTest` 時符合 schema
- [x] 6.2 在 treatments schema 加入選填的 `motionTest`,更新 fixture、`treatments.md` 的欄位對應,直到測試通過

## 7. 驗收
- [x] 7.1 執行全部 pytest,確認通過且沒有略過的測試
- [x] 7.2 用 `video/morning-steam` 執行 brief.py,確認在新的路徑檢查下仍然可以成功產生
