## Purpose

讓使用者在網頁上看到影片製作的每個階段、每顆鏡頭的資訊與即時進度,並在 gate 上修改內容、決定繼續或重做.

## ADDED Requirements

### Requirement: 只對本機開放並防護寫入請求
studio SHALL 只綁定 127.0.0.1;所有會寫入狀態的請求 SHALL 要求 JSON content-type,拒絕 cross-site 請求、opaque origin 與無法解析的 Origin,並在請求帶有 Origin 時要求它與 Host 一致 (沒有 Origin 的非瀏覽器請求不受這項限制);Host 本身另由 Vite 的 host 檢查把關.

#### Scenario: 其他網站對 studio 送出寫入請求
- **WHEN** 瀏覽器中另一個網站對 studio 送出回覆 gate 的請求
- **THEN** studio 拒絕該請求,狀態檔不變,Claude 不會被喚醒

### Requirement: 專案列表
studio SHALL 列出 video 目錄下名稱為 kebab-case slug、且有 storyboard.json 或 studio/intake.json 的專案,並 SHALL 隱藏兩者都沒有的舊專案.

#### Scenario: 剛從網頁送出 Intake 的專案
- **WHEN** 使用者剛從網頁送出一個新專案的 Intake,還沒有 storyboard.json
- **THEN** 該專案出現在列表中

#### Scenario: 舊專案
- **WHEN** video 目錄中有一個只有 brief.md 的舊專案
- **THEN** 該專案不出現在列表中,也不會被修改

### Requirement: 從網頁開始新專案
studio SHALL 讓使用者在網頁填寫 Intake (草稿、prompt、想法、規格、profile、品牌與素材的本機路徑);送出時 SHALL 立即建立專案目錄與持久的 intake 檔,並把專案指派給一個線上的 session (只有一個時自動選擇,多個時由使用者選擇).

#### Scenario: 只有一個線上 session
- **WHEN** 使用者送出 Intake,workspace 只有一個線上 session
- **THEN** 專案自動指派給該 session,Claude 被喚醒並開始 Intake

#### Scenario: 沒有線上 session
- **WHEN** 使用者送出 Intake,但沒有任何線上 session
- **THEN** 專案與 intake 檔仍然被建立
- **AND** 網頁提示使用者先在 workspace 開啟 Claude Code,之後再指派

### Requirement: 各階段 gate 的顯示與回覆
studio SHALL 依目前 gate 的階段顯示對應內容並提供對應的回覆: Intake (gate 開啟前顯示送出的表單;gate 時顯示 Claude 的追問,可以逐題回答或留空採用預設值,回答併入意見)、Treatments (三張方案卡與 style frame;可選一、以一個方案為基礎混搭其他方案的元素,或全部重做)、分鏡 (鏡頭與 storyboard critic 報告)、Assets (素材、asset critic 報告與 ledger)、Build animatic、Build 精修 (預覽、stills、critic 結果與 render 時間估計)、Audio (混音播放、cue 與 loudness 報告)、每輪 Gauntlet (critic 重點、量測與 review log;可選再一輪或交片)、Deliver (成片、poster、交付說明與待確認事實).每個回覆 SHALL 附上這個 gate 期間在網頁上的改動清單,studio 重新啟動也不會遺失.studio SHALL 讓使用者為每個 gate 個別設定 auto-continue.studio 發現專案出現超出已通過階段的新產出時 (Treatments 還沒選定就出現 storyboard.json;分鏡還沒核准就出現或修改 index.html 或 qa/stills/ 下的檔案),SHALL 顯示 Claude 可能跳過該 gate 的警告;設為 auto-continue 的階段視為已通過.

#### Scenario: Treatments 混搭
- **WHEN** 使用者在 Treatments gate 選 B 為基礎,勾選 A 的 Look 與 C 的結構並填寫意見
- **THEN** 回覆記錄基礎方案、混搭的元素與意見,Claude 被喚醒後依此修改

#### Scenario: studio 重新啟動後才回覆
- **WHEN** 使用者在 gate 編輯鏡頭後,studio 重新啟動 (例如最後一個 session 離開後再次 `/studio start`),才送出回覆
- **THEN** 回覆仍然列出重新啟動前的改動

#### Scenario: Gauntlet 再一輪
- **WHEN** 使用者在 Gauntlet gate 選擇再一輪並指定優先項目
- **THEN** 回覆記錄再一輪與優先項目

#### Scenario: v1 不能回到前面的階段
- **WHEN** 使用者在 Build animatic gate 想改用另一個方案的色調
- **THEN** 網頁只提供目前階段的回覆,使用者在意見中說明,由 Claude 判斷重做範圍

#### Scenario: 對 Audio gate 開啟 auto-continue
- **WHEN** 使用者對 Audio gate 開啟 auto-continue
- **THEN** 之後到達 Audio gate 時,Claude 不停下,直接繼續

#### Scenario: 分鏡還沒核准就出現 Build 產出
- **WHEN** 分鏡 gate 還沒核准,專案的 qa/stills/ 卻出現新的鏡頭 stills
- **THEN** 網頁顯示 Claude 可能跳過了分鏡 gate 的警告

### Requirement: gate 時的鏡頭編輯
studio SHALL 只在專案停在 gate 時允許編輯;Claude 工作中與回覆送出之後,鏡頭欄位、gate 的選項與回覆按鈕 SHALL 為唯讀 (auto-continue 設定、重新指派與解鎖不受影響).編輯時,每顆鏡頭 SHALL 提供四個主技巧欄位 (鏡頭大小、角度、運鏡、轉場) 的單選與其他技巧類別的多選標籤,選項來自技巧庫索引與專案自訂技巧 (標示為自訂);主技巧欄位 SHALL 顯示所選技巧的摘要,任一技巧都可以開啟完整的技巧說明.變更 SHALL 立即寫入 storyboard.json 並列入改動清單,隨回覆送出,由 Claude 同步自由文字與程式碼.

#### Scenario: Claude 工作中
- **WHEN** 專案的 gate 已經回覆,Claude 正在工作
- **THEN** 鏡頭欄位與回覆按鈕都不能操作

#### Scenario: 更換運鏡
- **WHEN** 使用者在分鏡 gate 把某顆鏡頭的運鏡從 push-in 換成 crane-up 並送出
- **THEN** storyboard.json 的運鏡欄位立即更新,改動清單列出該欄位並隨回覆送出
- **AND** Claude 被喚醒後改寫該鏡頭的 Camera 文字與相關程式碼

#### Scenario: 專案有自訂技巧
- **WHEN** 專案的 techniques 目錄有一個技巧庫沒有的自訂技巧檔
- **THEN** 該技巧出現在對應類別的選項中,並標示為自訂

### Requirement: 修改時長時自動順延並平移 cue
在 gate 修改鏡頭時長時,studio SHALL 讓後續鏡頭順延,總長隨之改變;audio plan 中屬於後續鏡頭的 cue (依「起點 ≤ cue 時間 < 終點」歸屬) SHALL 精確平移相同的時間差;被改鏡頭內的 cue SHALL 維持原位,並在改動清單中標為需要重新對齊;若專案有配樂,改動清單 SHALL 加上配樂需要重新剪接.

#### Scenario: 拉長中間的一顆鏡頭
- **WHEN** 使用者把第 3 顆鏡頭從 3.16 秒改成 4.0 秒
- **THEN** 第 4 顆以後的鏡頭起點都延後 0.84 秒,總長增加 0.84 秒
- **AND** 第 4 顆以後鏡頭的 cue 時間都增加 0.84 秒
- **AND** 第 3 顆鏡頭內的 cue 維持原位並標記為需要重新對齊

#### Scenario: 剛好落在鏡頭起點的 cue
- **WHEN** 一個 cue 剛好落在第 4 顆鏡頭的起點,使用者拉長第 3 顆鏡頭
- **THEN** 該 cue 屬於第 4 顆鏡頭,跟著平移

### Requirement: render(t) 預覽
studio SHALL 以不經轉換的純靜態方式提供專案頁面,root 與 MIME 規則跟 render 腳本相同 (root 為專案目錄,或 storyboard 宣告的 renderRoot,對應 render 腳本的 --root;renderRoot 在 video 目錄之外時不提供預覽),並支援 HTTP Range;預覽 SHALL 等頁面表示載入完成後才呼叫 `render(t)` 並等待其完成;專案中影響畫面的檔案變動時 SHALL 在 debounce 後重新載入預覽 (studio、qa、out 目錄、storyboard.json、treatments.json、audio/plan.json 以及 studio 自己寫入的檔案不會觸發).

#### Scenario: 拖曳時間軸
- **WHEN** 使用者把播放頭拖到 7.5 秒
- **THEN** 預覽顯示 `render(7.5)` 的畫面,與 render 腳本在 7.5 秒輸出的畫面一致

#### Scenario: 使用 module script 的頁面
- **WHEN** 專案頁面使用 ES module 或 import map
- **THEN** 預覽正常顯示,頁面內容沒有被改寫

#### Scenario: 播放成片
- **WHEN** 使用者在 Deliver gate 拖曳成片的播放進度
- **THEN** 影片從拖曳的位置開始播放

### Requirement: 即時進度與 session 狀態
mod SHALL 記錄每個工具呼叫的開始、結束與簡短摘要;render 腳本 SHALL 支援進度檔參數,定期寫入目前幀數、總幀數與預估剩餘時間,且 web 模式的協定 SHALL 要求 Claude 帶上這個參數;web 模式下 Claude SHALL 把 Build 時每顆鏡頭的狀態與 stills 路徑寫入 Build 進度檔,而不是 storyboard.json.studio SHALL 顯示線上 session 的短 id、啟動時間與狀態、活動紀錄、render 進度,以及 Claude 正在 terminal 等待授權的提示;持有者離線時 SHALL 提供重新指派與手動解鎖.

#### Scenario: Claude 派出 critic
- **WHEN** Claude 派出一個 storyboard critic subagent
- **THEN** 網頁的活動紀錄顯示正在進行 critic 審查

#### Scenario: render 進度
- **WHEN** Claude 在 web 模式執行整片 render
- **THEN** 網頁顯示幀數進度與預估剩餘時間

#### Scenario: CLI 模式的 render
- **WHEN** 使用者在 CLI 模式執行 render,沒有帶進度檔參數
- **THEN** render 的行為和輸出跟原本一樣

#### Scenario: 一顆鏡頭完成
- **WHEN** Claude 在 web 模式完成一顆鏡頭並產出 stills
- **THEN** Build 進度檔更新該鏡頭的狀態與 stills 路徑,storyboard.json 不變,網頁顯示新的 stills

#### Scenario: Claude 等待授權
- **WHEN** Claude 在 terminal 等待權限授權
- **THEN** 網頁顯示 Claude 正在 terminal 等你授權

#### Scenario: 持有者離線
- **WHEN** 持有專案的 session 被判定離線
- **THEN** 網頁顯示離線,並讓使用者選擇一個線上 session 接手或手動解鎖

### Requirement: 介面語言
studio SHALL 提供繁體中文與英文介面,介面本身的字串 SHALL 來自 locale 檔;server 回傳的錯誤細節、Claude Code 的授權訊息,以及專案與技巧庫的內容維持原文.

#### Scenario: 切換語言
- **WHEN** 使用者把介面語言切換成英文
- **THEN** 所有介面文字改為英文,專案內容不受影響

### Requirement: studio 的啟動與停止
在 init 建立的 workspace 中,mod SHALL 提供 `/studio` 指令 (start、stop、status;不帶參數等於 status),不經過模型直接執行.start SHALL 在背景啟動 studio,並在 studio 開始服務後回報實際網址;workspace 已經有正在服務的 studio 時,SHALL 沿用它並只回報網址.一般模式缺少 studio 依賴時,start SHALL 先自動安裝 (優先使用 pnpm,找不到時使用 npm);link 模式缺少依賴時,SHALL NOT 安裝,而是提示到 repo 安裝.只有啟動了新的 studio 時,start SHALL 開啟瀏覽器.還有其他線上 session 時,stop SHALL 拒絕,除非使用者加上 force 選項.session 因為使用者離開、登出或 signal 而結束,且沒有其他線上 session 時,mod SHALL 停止 studio;`/clear` 與 resume SHALL NOT 停止 studio.status line SHALL 顯示 studio 的網址,沒有在執行時顯示未啟動;Claude 開 gate (auto-continue 的 gate 除外) 時 studio 沒有在執行,mod SHALL 在開 gate 的結果中要求 Claude 提醒使用者啟動 studio.

#### Scenario: 在 workspace 啟動 studio
- **WHEN** 使用者在 workspace 的 Claude Code 執行 `/studio start`,且 studio 沒有在執行
- **THEN** studio 在背景啟動,指令回報實際網址並開啟瀏覽器
- **AND** status line 顯示該網址

#### Scenario: studio 已經在執行
- **WHEN** 使用者執行 `/studio start`,workspace 已經有正在服務的 studio (由其他 session 啟動,或是之前留下的)
- **THEN** 不啟動新的 studio,也不開啟瀏覽器,只回報既有的網址

#### Scenario: 一般模式還沒安裝依賴
- **WHEN** 使用者在一般模式的 workspace 第一次執行 `/studio start`,studio 依賴還沒安裝
- **THEN** 先安裝依賴 (優先使用 pnpm),再啟動 studio

#### Scenario: link 模式還沒安裝依賴
- **WHEN** 開發者在 link 模式的 workspace 執行 `/studio start`,repo 還沒安裝 studio 依賴
- **THEN** 不安裝也不啟動,訊息提示到 repo 執行安裝

#### Scenario: 還有其他線上 session 時停止
- **WHEN** 使用者執行 `/studio stop`,workspace 還有其他線上 session
- **THEN** studio 繼續執行,訊息列出那些 session,並說明加上 force 選項才會停止

#### Scenario: 最後一個 session 離開
- **WHEN** workspace 唯一的線上 session 以 `/exit` 結束
- **THEN** studio 停止

#### Scenario: 還有其他 session 時離開
- **WHEN** 兩個線上 session 中的一個以 `/exit` 結束
- **THEN** studio 繼續執行

#### Scenario: 執行 /clear
- **WHEN** 使用者在唯一的線上 session 執行 `/clear`
- **THEN** studio 繼續執行

#### Scenario: studio 沒有在執行時開 gate
- **WHEN** Claude 開 gate,但 workspace 沒有正在服務的 studio
- **THEN** gate 照常開啟,開 gate 的結果要求 Claude 提醒使用者執行 `/studio start`
