# Sync Report: add-web-studio
## Summary
Conclusion: PASS
## Requirements
### 只對本機開放並防護寫入請求
- Implementation: studio server 建立時綁定 127.0.0.1;API 的所有寫入 route 先經過 mutation request guard;預覽 middleware 只接受 GET/HEAD;外加 Vite 的 host 檢查
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 綁定改寫為 127.0.0.1;Origin 與 Host 只在請求帶有 Origin 時比對 (沒有 Origin 的非瀏覽器請求放行,無法解析的 Origin 拒絕);Host 由 Vite 把關.scenario 不變.tospec validate: valid

### 專案列表
- Implementation: server 的專案列表 (isStudioProject: storyboard.json 或 studio/intake.json) 與 UI 的專案列表
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 補上資料夾名稱必須是 kebab-case slug,並寫明 intake 檔是 studio/intake.json.scenario 不變.tospec validate: valid

### 從網頁開始新專案
- Implementation: server 的 Intake API、指派 (reason intake)、mod 接手指派後喚醒 Claude 讀取 intake.json;UI 的 Intake 表單與 session 選擇
- Verdict: MATCH
- Notes: 草稿、prompt 與想法合併為一個必填欄位,spec 沒有要求分開

### 各階段 gate 的顯示與回覆
- Implementation: UI 的各階段面板與回覆面板;server 的 reply 驗證把改動清單併入回覆,改動清單寫在 studio 狀態目錄的檔案中;auto-continue 設定與 mod 開 gate 時的判斷;跳過 gate 的偵測
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 第一次判定為 CODE-BUG: 改動清單只在記憶體,studio 重新啟動後的回覆不會附上.已經在 tasks 11.1–11.3 修正 (改動清單寫成檔案,回覆後刪除;新增 vitest「keeps the change list across a studio restart, until the reply」),重新判定後不再是 CODE-BUG.措辭修正: Intake 在 gate 開啟前顯示送出的表單、gate 時顯示 Claude 的追問;混搭以一個方案為基礎;改動清單在重新啟動後保留;跳過 gate 的警告只涵蓋 Treatments 選定前出現 storyboard.json,以及分鏡核准前出現或修改 index.html 與 qa/stills/ 下的檔案,auto-continue 的階段視為已通過.混搭與 stills 的 scenario 跟著修正,新增 scenario「studio 重新啟動後才回覆」.tospec validate: valid

### gate 時的鏡頭編輯
- Implementation: UI 的 inspector 與鏡頭編輯欄位;server 的技巧索引 (含專案自訂技巧) 與 storyboard 欄位更新 (只在 gate 開啟時)
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 唯讀的範圍改為鏡頭欄位、gate 的選項與回覆按鈕 (auto-continue、重新指派與解鎖不受影響);摘要只顯示在主技巧欄位所選的技巧,任一技巧都可以開啟完整說明;編輯立即寫入 storyboard.json,改動清單隨回覆送出.「更換運鏡」的 THEN 跟著修正.tospec validate: valid

### 修改時長時自動順延並平移 cue
- Implementation: server 的 ripple 純函式與時長編輯 API;UI 的時長欄位、重新對齊提示與時間軸標記
- Verdict: MATCH
- Notes: 超過片尾的 cue 也會平移,不與 spec 衝突

### render(t) 預覽
- Implementation: server 的靜態預覽 middleware (render.py 的 MIME 表、Range、renderRoot);UI 的預覽元件;watcher 的 300 ms debounce
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 補上 root 可以是 storyboard 的 renderRoot (在 video 目錄之外時不提供預覽);只有影響畫面的檔案變動才重新載入,studio、qa、out 目錄、專案資料檔與 studio 自己寫入的檔案不會.scenario 不變.tospec validate: valid

### 即時進度與 session 狀態
- Implementation: mod 的活動紀錄;render.py 的進度檔;mod 協定;server 的 session、permission 與 render 進度輪詢;UI 的 session bar、活動紀錄、render 進度條、Build 進度與持有者面板
- Verdict: MATCH
- Notes: 無

### 介面語言
- Implementation: zh-TW 與 en locale 檔、locale provider 與語言切換
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: 介面本身的字串來自 locale 檔;server 回傳的錯誤細節、Claude Code 的授權訊息,以及專案與技巧庫的內容維持原文.scenario 不變.tospec validate: valid

### studio 的啟動與停止
- Implementation: mod 的 /studio 指令、session.end 停止邏輯與 status line;launcher 與 stop script
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: studio 沒有在執行時,由 mod 在開 gate 的結果中要求 Claude 提醒使用者;auto-continue 的 gate 不提醒.「studio 沒有在執行時開 gate」的 THEN 跟著修正.tospec validate: valid

### init 的前置檢查
- Implementation: init 的目標目錄與 Node 版本檢查、下一步指示
- Verdict: MATCH
- Notes: 無

### init 產生 workspace 的設定檔
- Implementation: init 產生的 package.json、Claude Code 專案設定、gitignore 與 video 目錄
- Verdict: SPEC-UPDATED (updated to match code)
- Notes: package.json 的約束改寫為「studio 依賴,不含 dev 指令或其他 script」(另有 private 與 type 欄位).tospec validate: valid
