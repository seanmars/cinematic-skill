# Sync Report: fix-preview-missing-page
## Summary
Conclusion: PASS
## Requirements
### 專案頁面寫出之前的預覽
- Implementation: UI 的預覽元件先以 HEAD 確認頁面存在才掛上 iframe;回 404 時在預覽的位置顯示 preview.missing 提示,不顯示載入中或 timeout 訊息;收到 studio:preview 推送時重新檢查.預覽面板的時間軸與播放頭不受影響
- Verdict: MATCH
- Notes: task.md 的 feedback loop (probe) 為 GREEN: 沒有 index.html 時 missing 為 True、iframe 為 False;寫入 index.html 後不重新整理網頁就換成預覽.server 對還沒寫出的頁面回 HEAD 404 的契約由 preview.test.mjs 鎖住.diff 中沒有 Requirement 以外的行為
