# studio-bridge Specification

## Purpose
讓 web studio 與在 terminal 執行的 Claude Code 透過檔案與 project 層 mod 雙向溝通: Claude 在 gate 停下,使用者回覆後,Claude 被自動喚醒並接續.

## Requirements

### Requirement: 依 mod 是否載入決定模式
有載入 studio mod 時,mod SHALL 透過 system prompt 注入 web 模式的協定,其中明訂每個階段結束都要開 gate,並覆蓋 SKILL.md 的單一 approval gate 規則;沒有載入 mod 時,skill SHALL 維持 CLI 模式的行為 (只有 Treatments 一個 approval gate).

#### Scenario: 載入 mod 的 session
- **WHEN** Claude 在載入 studio mod 的 session 中製作影片
- **THEN** Claude 在每個階段結束時呼叫 gate 工具,而不是自主進入下一個階段

#### Scenario: 全域的舊版 SKILL.md 蓋過副本
- **WHEN** 使用者全域安裝了舊版 skill,但 session 仍然載入了 workspace 的 studio mod
- **THEN** web 模式的協定仍然由 mod 注入並生效

### Requirement: gate 工具開啟 gate 後結束這一輪
mod SHALL 提供 gate 工具;Claude 呼叫時,mod SHALL 把 gate 的階段與 payload 寫成專案中新的 gate 檔 (gate 歷史只新增、不改寫).若該階段設為 auto-continue,工具 SHALL 立即回傳已核准;否則工具 SHALL 告知 Claude 結束這一輪並等待喚醒,而不是阻塞等待.

#### Scenario: 一般 gate
- **WHEN** Claude 在分鏡階段結束時呼叫 gate 工具,且該階段沒有設定 auto-continue
- **THEN** 專案出現新的 gate 檔
- **AND** Claude 結束這一輪,等待期間不消耗 model 用量

#### Scenario: auto-continue 的 gate
- **WHEN** Claude 呼叫 gate 工具,且該階段設為 auto-continue
- **THEN** gate 檔仍然被寫入 (保留歷史),工具立即回傳已核准,Claude 繼續下一個階段

### Requirement: 回覆送達並喚醒 Claude,不重複處理
被指派的 mod SHALL 定期檢查專案中還沒送達的回覆;發現回覆時 SHALL 用 prompt.submit 喚醒 Claude,內容包含 gateId、回覆、意見與改動清單,並在新的一輪開始後 SHALL 在 gate 檔寫入送達時間.已有送達時間的回覆 SHALL NOT 再次送出,即使暫存資料被清除;協定 SHALL 要求 Claude 略過已經處理過的 gateId.讀到寫一半或無法解析的檔案時,mod SHALL 略過並在下一次輪詢重試.

#### Scenario: 回覆檔出現
- **WHEN** 一個開啟中的 gate 出現對應的回覆檔
- **THEN** 被指派的 session 在數秒內被喚醒並開始新的一輪
- **AND** gate 檔記錄送達時間

#### Scenario: 清除暫存資料後重新開啟 session
- **WHEN** 使用者重新安裝依賴 (暫存目錄被清除) 後開啟新的 session 並被指派同一個專案
- **THEN** 已經送達過的回覆不會再被送出

#### Scenario: 讀到寫一半的回覆檔
- **WHEN** mod 輪詢時讀到一個無法解析的回覆檔
- **THEN** mod 略過這一次,下一次輪詢時重新讀取並正常送達

### Requirement: 指派與 session 狀態
每個 mod SHALL 只處理指派給其 session id 的專案,SHALL NOT 自行認領其他專案;被重新指派時,mod SHALL 用「接續某專案的某 gate」的內容喚醒 Claude.mod SHALL 定期在自己的 session 檔寫入心跳、短 id 與目前專案,在 terminal 的 status line 顯示短 id,並在 session 結束時立即標記離線.

#### Scenario: 同一個 workspace 有兩個 session
- **WHEN** workspace 內有兩個載入 mod 的 session,其中一個 session 被指派的專案出現回覆
- **THEN** 只有被指派的 session 被喚醒

#### Scenario: 重新指派給新的 session
- **WHEN** 專案的指派從離線的 session 改成另一個線上的 session
- **THEN** 該 session 被喚醒,收到接續該專案目前 gate 的指示與還沒送達的回覆

#### Scenario: session 正常結束
- **WHEN** 使用者結束 Claude Code session
- **THEN** 該 session 檔立即標記為離線

#### Scenario: 長時間 render 期間
- **WHEN** Claude 正在執行數分鐘的 render
- **THEN** 心跳持續更新,session 不會因為心跳逾時被判定離線

### Requirement: 未核准時擋下整片高畫質 render
在 Build 精修 gate 還沒核准、也沒有設定 auto-continue 的專案中,mod SHALL 拒絕整片的高畫質 render 指令,並在拒絕訊息中要求 Claude 先開 gate;單張 stills、seek test 與部分時段的 render SHALL NOT 被擋.

#### Scenario: 跳過精修 gate 直接 render
- **WHEN** Claude 在 Build 精修 gate 還沒核准時執行整片 render 到輸出目錄
- **THEN** 該指令被拒絕,Claude 收到需要先開 gate 的訊息

#### Scenario: 渲染 stills
- **WHEN** Claude 在 Build 階段渲染單張 stills
- **THEN** 指令正常執行
