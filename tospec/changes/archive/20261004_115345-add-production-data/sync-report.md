# Sync Report: add-production-data
## Summary
Conclusion: PASS
## Requirements
### storyboard.json 是兩種模式共用的 SSOT
- Implementation: skill 的 storyboard JSON Schema (鏡頭結構與四個技巧欄位) 與 brief 產生器的時間累加; SKILL.md Step 4 規定先寫 storyboard.json
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: schema 只要求 Picture 與 Job,Action、Camera、Audio、Transition 是選填;鏡頭順序沒有獨立欄位,是陣列順序.spec 原本寫成六個文字欄位都必填,並把「順序」列為鏡頭內容.因為 capability 是新的,所以直接修正 ADDED 區塊,沒有用 MODIFIED.tospec validate: valid, 0 issues.「推算起訖時間」由測試涵蓋;「CLI 模式完成分鏡」用 video/morning-steam 確認 storyboard.json 符合 schema.
### Claude 寫分鏡時填好主技巧欄位
- Implementation: shot-design.md 的 Storyboarding 段落 (四個欄位、null 的使用時機、欄位與文字不一致時以欄位為準) 與 SKILL.md Step 4
- Verdict: MATCH
- Notes: video/morning-steam 每顆鏡頭的四個欄位都有值或明確為 null (transition 為 null,屬於沒有 cut 的情況).
### 新技巧寫成專案自訂技巧檔
- Implementation: shot-design.md 的查找流程第 4 步與 Custom techniques 段落;SKILL.md Step 4;brief 產生器的查找順序 (技巧庫 → 專案)
- Verdict: MATCH
- Notes: 流程是先查 INDEX.md 排除別名,再上網查證,查不到才詢問使用者 (source: user),並明文禁止修改技巧庫.
### Treatments 寫入 treatments.json
- Implementation: skill 的 treatments JSON Schema;treatments.md 的欄位對應表;SKILL.md Step 2 與 Step 3
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 程式會把選定的方案記錄在 treatments.json 的 chosen (id、mix、notes),schema 也包含字體與商業片的 CTA,但 spec 原本都沒有寫到.已補進 Requirement,scenario 也補上「記錄選定的是方案 B」.tospec validate: valid, 0 issues.video/morning-steam 保留 A、B、C,chosen 是 B.
### brief.md 由 storyboard.json 產生
- Implementation: brief 產生器 (檔頭、區塊順序、時間累加、技巧名稱解析、先檢查全部路徑再寫檔、錯誤訊息附查證流程);brief-template.md;SKILL.md 規定不手動修改 brief.md
- Verdict: MATCH
- Notes: 「路徑打錯字」「引用專案自訂技巧」「重新產生」「可以當作 prompt」都由 pytest 涵蓋並通過.
### SFX plan 的固定位置
- Implementation: audio_tools.py mix 的 --plan 與 --sfx-dir 參數 (說明範例已更新);audio.md 與 SKILL.md Step 8 的指令
- Verdict: MATCH
- Notes: --sfx-dir 是既有參數,本 change 只更新文件範例,符合 design D5.
### CLI 模式的 approval gate 維持不變
- Implementation: SKILL.md Step 3 (唯一的 approval gate) 與 Step 4 (技巧庫與網路都查不到時,即使已核准也要詢問使用者)
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: spec 原本把影響限定在 treatments.json、storyboard.json 與 brief.md,但實作還包含專案自訂技巧檔、SFX plan 與音效檔的位置,以及核准後遇到查不到的技巧時要詢問使用者.已更新 Requirement 與 scenario,說明這個唯一的例外.tospec validate: valid, 0 issues.
