## ADDED Requirements

### Requirement: 專案頁面寫出之前的預覽
專案已經有 storyboard、但 Claude 還沒寫出專案頁面時,預覽 SHALL 在預覽的位置顯示「還沒有畫面、頁面寫出後會自動出現」的提示,SHALL NOT 等待頁面載入,也 SHALL NOT 顯示頁面沒有準備好的錯誤;時間軸與播放頭 SHALL 照常顯示.頁面寫出後,預覽 SHALL 不需要重新整理網頁就改為顯示頁面.

#### Scenario: 分鏡已寫出、頁面還沒寫出
- **WHEN** 專案有 storyboard.json,但還沒有 index.html
- **THEN** 預覽的位置顯示還沒有畫面的提示
- **AND** 時間軸與播放頭照常顯示,不出現載入中或頁面沒有準備好的訊息

#### Scenario: 頁面寫出
- **WHEN** Claude 在 Build 階段寫出 index.html
- **THEN** 預覽不需要重新整理網頁就改為顯示頁面
