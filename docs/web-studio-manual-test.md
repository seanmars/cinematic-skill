# Web studio 手動測試步驟

在一個乾淨的資料夾,用真正的 Claude Code 從 Intake 一路做到 Deliver,驗證 add-web-studio 中需要人工確認的項目 (tasks.md 的 1.4、3.6、5.4、6.4、7.4、9.2),並順便確認 spec 中其他需要真實 session 的情境.

整個流程大約需要 1 到 2 小時,大部分時間在等 Claude 製作.

## 0. 準備

以下 `<repo>` 代表這個 repo 的路徑.

### 需要的工具

在 PowerShell 確認版本:

```powershell
node -v          # 需要 22.12 以上
pnpm -v
uv --version
ffmpeg -version
claude --version # 需要支援 plugin mod (function hooks) 的版本;開發時用的是 2.1.289
```

確認 render 環境 (ffmpeg、瀏覽器、WebGL):

```powershell
uv run <repo>\skills\cinematic-video\scripts\check_env.py
```

最後一行應該是 `ready`.

### 選一個乾淨的資料夾

- 資料夾**不能在任何 git repo 裡面** (例如不要放在 `<repo>` 底下),避免 Claude Code 讀到其他層的 `.claude/skills`.
- 資料夾要不存在,或是空的 (只有隱藏檔也可以).

以下用 `D:\studio-test` 當例子,請換成你的路徑.

## 1. 建立 workspace

```powershell
node <repo>\skills\cinematic-video\studio\init.mjs D:\studio-test
cd D:\studio-test
pnpm install
```

**預期結果**

- init 印出下一步指示 (`pnpm install`、`pnpm dev`、`claude`).
- 資料夾裡有: `.claude\skills\cinematic-video\` (skill 的完整副本)、`.claude\settings.json`、`studio.config.json`、`package.json`、`.gitignore`、`video\`.
- `.claude\skills\cinematic-video\.claude-plugin\plugin.json` 和 `.claude\skills\cinematic-video\hooks\hooks.json` 存在 (這是讓 Claude Code 載入 mod 的 manifest).

## 2. 啟動 studio 與 Claude Code

**Terminal A** (studio):

```powershell
cd D:\studio-test
pnpm dev
```

用瀏覽器開啟它印出的網址 (通常是 http://127.0.0.1:5173;5173 被佔用時會自動換下一個 port).

**Terminal B** (Claude Code):

```powershell
cd D:\studio-test
claude
```

第一次會出現 workspace 信任提示,選擇信任.

**預期結果**

- [ ] Claude Code 的 status line 出現 `studio xxxxxx` (6 碼短 id).
- [ ] 網頁右上角出現同一個短 id,顯示「下午 xx:xx 啟動 · 閒置」,左邊的點是綠色.
- [ ] 網頁左側專案列表是空的,顯示「還沒有專案」的說明.

如果 status line 沒有出現短 id,先看最後的「疑難排解」.

## 3. Intake (9.2、2.x)

1. 網頁左側按「新專案」.
2. 填寫:
   - 想做什麼: `A paper plane folds itself from a sticky note and carries one word across a desk.`
   - 規格: `8s, 1920x1080, 30fps`
   - Profile: `Stylized`
   - 其他欄位留空.
3. 「交給哪個 session」應該顯示「會交給唯一的線上 session xxxxxx」.
4. 按「送出 Intake」.

**預期結果**

- [ ] 左側出現新專案 (`a-paper-plane-folds`),中間顯示「已送出的 Intake」.
- [ ] 右側 Session 區塊顯示「由 xxxxxx 處理 · 線上」.
- [ ] 幾秒內,Terminal B 的 Claude 收到 `[studio project a-paper-plane-folds] ...` 訊息並開始 Intake.
- [ ] 右側「活動」開始出現 Claude 的工具呼叫 (進行中的會有閃爍的藍點).
- [ ] Claude 結束 Intake 時開啟 gate: 左側階段列表的 Intake 變成黃點,中間出現「Claude 的追問」,每題的灰色文字是預設值.

## 4. 第一個 gate 的喚醒 (1.4)

1. 在其中一題填寫答案 (例如把 runtime 改成別的),其他留空.
2. 按右側「送出回答」,同時開始計時.

**預期結果**

- [ ] 網頁狀態變成「已回覆, 等待 Claude 接手」,所有欄位變成唯讀.
- [ ] **2 到 3 秒內**,Terminal B 出現 `[studio gate 001-intake] ...` 訊息,Claude 開始工作.網頁狀態變成「Claude 工作中」.
- [ ] Claude 的回應有採用你填的答案,留空的題目用預設值.

## 5. Treatments 混搭 (7.4、spec「Treatments 混搭」)

Claude 寫好三個方案和 style frame 後會開啟 Treatments gate.

**檢查面板**

- [ ] 中間出現三張方案卡: 標題、logline、style frame 圖片、Look 說明與色票、規格、技術、聲音、估時、風險、鏡頭表、signature moves.
- [ ] style frame 圖片能正常顯示 (不是破圖).

**操作**

1. 在方案 A 選「以 A 為基礎」.
2. 在方案 C 勾選「結構」.
3. 「給 Claude 的意見」填一句,例如 `Warmer grade than A.`
4. 確認「選用 A」是灰的,「以 A 為基礎混搭」可以按.按下「以 A 為基礎混搭」.

**預期結果**

- [ ] Claude 被喚醒,訊息中有 `decision: mix` 和 `choice: {"id":"A","mix":[{"option":"C","element":"structure"}]}`.
- [ ] Claude 把選擇寫進 `video\a-paper-plane-folds\treatments.json` 的 `chosen` (含 `mix`),然後開始寫分鏡.

## 6. 分鏡 gate: 更換運鏡 (5.4、spec「更換運鏡」「專案有自訂技巧」)

**檢查面板**

- [ ] 中間上方出現預覽 (如果 Claude 已經寫了 `index.html`)、播放頭和時間軸;時間軸的鏡頭寬度依時長排列.
- [ ] 中間下方是「分鏡 gate」與 storyboard critic 報告.
- [ ] 中間最上方沒有出現紅色的「Claude 可能跳過了...」警告.

**操作**

1. 在時間軸點第 2 顆鏡頭,右側出現該鏡頭的編輯欄位.
2. 「運鏡」換成另一個技巧 (例如 `Crane Up`),下方會出現技巧摘要;按「技巧說明」可以看完整說明,按「關閉」離開.
3. 在「對這顆鏡頭的意見」填一句.
4. 確認「改動清單」出現 `shots[<id>].techniques.movement`.
5. 按「核准」.

**預期結果**

- [ ] 換運鏡後,`storyboard.json` 該鏡頭的 `techniques.movement` 立刻改變 (不需要等回覆).
- [ ] 回覆送出後,所有欄位變成唯讀,上方顯示「Claude 工作中, 目前只能檢視.」.
- [ ] Claude 的喚醒訊息 `changes:` 列出該欄位,`notes:` 有 `<鏡頭 id>: 你的意見`.
- [ ] Claude 依新的運鏡改寫該鏡頭的 Camera 文字與相關程式碼,並重新產生 `brief.md`.

**選做 (自訂技巧)**: 回覆前,在 `video\a-paper-plane-folds\techniques\camera-movement\` 放一個自訂技巧檔 (格式同技巧庫,frontmatter 要有 `name`,內文要有 `Summary:` 一行),重新整理網頁並再點一次鏡頭,運鏡選單應該出現「名稱 (自訂)」.

## 7. Build: 鏡頭進度與 stills (3.6「一顆鏡頭完成」)

Claude 製作鏡頭時,不需要操作,只要觀察:

- [ ] 中間出現「Build 進度」,每顆鏡頭顯示「尚未開始 / 製作中 / 完成」.
- [ ] 鏡頭完成後出現 stills 縮圖.
- [ ] `storyboard.json` 在這段期間沒有因為進度而被改動 (進度只寫在 `studio\progress.json`).
- [ ] Claude 渲染 stills 或部分片段時,沒有被 render guard 擋下.

## 8. Build animatic: 自動繼續 (spec「對某個 gate 開啟 auto-continue」)

在 Claude 開啟 Build animatic gate **之前** (例如還在 Build 時),勾選左側階段列表「Build animatic」那一行右邊的「自動繼續」.

**預期結果**

- [ ] 勾選後,`video\a-paper-plane-folds\studio\settings.json` 是 `{"autoContinue": ["build-animatic"]}`.
- [ ] Claude 到了 Build animatic 時記錄 gate,但不停下來,直接進入下一個階段.網頁的 gate 狀態顯示「Claude 工作中 (自動繼續)」.

## 9. Build 精修與 render 進度 (3.6「render 進度」、spec「跳過精修 gate」)

**檢查面板**

- [ ] 「Build 精修 gate」顯示 component critic 結果與「Render 時間估計」.

**操作**: 按「核准並開始高畫質 render」.

**預期結果**

- [ ] Claude 開始整片 render.中間出現「Render」進度條,顯示「xx / 240 影格 · 預估剩餘 m:ss」,大約每秒更新一次.
- [ ] render 結束後顯示「完成, 共 240 影格, 花了 m:ss」.
- [ ] Claude 的 render 指令帶有 `--progress-file node_modules/.cinematic-studio/render/a-paper-plane-folds.json`.

## 10. Audio gate: 修改時長 (6.4、spec「拉長中間的一顆鏡頭」)

選在 Audio gate 測試,因為這時 `audio\plan.json` 一定已經存在.

**檢查面板**

- [ ] 中間有混音的音訊播放器,可以播放;下方是 loudness 報告.
- [ ] 時間軸的 SFX 音軌出現 cue 標記.

**操作**

1. 在時間軸點一顆中間的鏡頭,把右側「時長 (秒)」加 0.5 秒,按 Enter.
2. 觀察後再按「核准」(或「要求修改」並寫意見).

**預期結果**

- [ ] 時間軸立刻變化: 該鏡頭變長,後面的鏡頭往後移,總長增加 0.5 秒 (播放頭右邊的數字).
- [ ] 後面鏡頭的 cue 跟著往後移;該鏡頭內的 cue 留在原位並變成紅色.
- [ ] 右側出現「需要 Claude 重新對齊的 cue」列出 cue 名稱與時間;如果專案有配樂,還會出現「配樂需要重新剪接並重新混音」.
- [ ] `audio\plan.json` 只有時間欄位改變,而且一個 cue 仍然是一行.
- [ ] Claude 被喚醒後: 重新對齊紅色的 cue、更新程式碼與文字中的時間點,有配樂時重剪並重新混音.

## 11. Gauntlet: 再一輪與交片 (spec「Gauntlet 再一輪」)

**第一輪**

- [ ] 面板顯示「第 1 輪」、critic 報告、量測、「開啟 review log」連結 (點了會在新分頁打開).
- 在「再一輪時優先處理」寫兩行,按「再一輪」.
- [ ] Claude 的喚醒訊息有 `choice: {"priorities":[...]}`,第二輪先處理你列的項目.

**第二輪**: 按「交片」.

- [ ] Claude 進入 Deliver.

## 12. Deliver (spec「播放成片」)

- [ ] 成片 `out/final.mp4` 可以播放;**拖曳播放進度後,影片從拖曳的位置開始播放**.
- [ ] 顯示 poster、交付說明、「需要你確認的事實」.
- 按「結案」.
- [ ] Claude 收到 `decision: approve`,結束專案.

## 13. 其他情境 (任何時間都可以測)

### Claude 等待授權

當 Terminal B 出現權限提示時 (例如 Claude 要執行沒有預先允許的指令):

- [ ] 網頁右上角該 session 變成黃點,顯示「在 terminal 等你授權」.
- [ ] 右側 Session 區塊顯示「Claude 正在 terminal 等你授權: ...」.
- [ ] 在 terminal 回答之後,等那個工具呼叫結束 (最慢在 Claude 呼叫下一個工具時),提示就會消失.

### 持有者離線、重新指派與手動解鎖

1. 在 Terminal B 結束 Claude Code (`/exit`).
   - [ ] 網頁上該 session 不再顯示為線上;專案顯示「由 xxxxxx 處理 · 離線」與說明.
2. 開一個新的 Terminal C,在同一個資料夾執行 `claude`.
   - [ ] 網頁出現新的短 id.
3. 在專案右側選新的 session,按「交給這個 session 接手」.
   - [ ] 新的 Claude 收到 `[studio project ...] ... Continue from gate ...`,從目前的 gate 接續.
4. (選做) 再結束一次 Claude,改按「手動解鎖」.
   - [ ] 專案顯示「還沒有指派給任何 session」,可以再指派給之後開啟的 session.

### 多個 session

同時開兩個 `claude`,再送出一個新的 Intake:

- [ ] 表單的「交給哪個 session」列出兩個 session,沒選之前不能送出.

### 舊專案不會出現

在 `video\` 下建立一個只有 `brief.md` 的資料夾 (例如 `video\old-promo\brief.md`):

- [ ] 它不會出現在專案列表,資料夾內容也不會被改動.

### 介面語言

按右上角的「English」:

- [ ] 所有介面文字變成英文,專案內容 (Intake 文字、critic 報告等) 不變.
- [ ] 重新整理頁面後仍然是英文.按「繁體中文」切回.

### 預覽

在有 storyboard 與 `index.html` 之後:

- [ ] 拖曳播放頭,預覽跟著顯示該時間點的畫面.
- [ ] Claude 修改 `index.html` 後,預覽自動重新載入,網頁本身不會整頁重新整理 (例如右側的輸入內容不會消失).

## 回報

把每一節的結果告訴我即可,格式例如:

```
4. OK,約 2 秒喚醒
6. 有問題: Claude 沒有改寫 Camera 文字 (附上 replies/003-storyboard.json)
```

有問題的項目,附上這些檔案會很有幫助:

- `video\<slug>\studio\gates\<gateId>.json` 與 `video\<slug>\studio\replies\<gateId>.json`
- `node_modules\.cinematic-studio\assignments\<slug>.json`
- `node_modules\.cinematic-studio\sessions\<sessionId>.json`
- 網頁截圖,以及 Terminal B 中 Claude 收到的喚醒訊息

## 疑難排解

| 現象 | 檢查 |
|---|---|
| status line 沒有 `studio xxxxxx` | 是否接受了 workspace 信任;`.claude\skills\cinematic-video\.claude-plugin\plugin.json` 與 `hooks\hooks.json` 是否存在;`studio.config.json` 是否在 workspace 根目錄;重新啟動 `claude` |
| 網頁看不到 session | `node_modules\.cinematic-studio\sessions\` 底下是否有該 session 的檔案,`heartbeatAt` 是否每 5 秒更新 |
| 回覆後 Claude 沒有被喚醒 | `replies\<gateId>.json` 是否存在;`assignments\<slug>.json` 的 `sessionId` 是否是目前的 session;gate 檔是否已經有 `deliveredAt` (有就代表已送出過) |
| 預覽顯示「頁面一直沒有準備好」 | 頁面是否定義了 `window.render`;如果有設 `window.ready = false`,載入完成後是否改成 `true` |
| `pnpm dev` 顯示 port 被佔用 | 直接使用它印出的新網址 |
| Claude 每一步都要授權 | `.claude\settings.json` 的 `permissions.allow` 是否包含 `mcp__cinematic-video__*` 與 `Bash(uv run .claude/skills/cinematic-video/scripts/*)` |

## 測試結束後

- 在 Terminal A 按 Ctrl+C 停止 studio,在 Terminal B 輸入 `/exit`.
- 整個 `D:\studio-test` 可以直接刪除,它和 repo 沒有關聯.
