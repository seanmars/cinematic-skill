# render.py 快速截圖與平行切段, 指令採 allowlist 形式

## Status

- proposed
- Date: 20261004_224828

## Context

playground 實測 (見 `20261004_224827-review-round-limits.md`) 中, 除了審查迴圈之外還有兩個主要的時間消耗:

- **render 速度**: 1080p 每格 512ms, 30 秒 900 格約 8 分鐘. 拆開量測後, `render(t)` 只占 3.6ms, 其餘 505ms 都花在 Playwright `page.screenshot` 預設的 PNG 壓縮 (畫面有 film grain, zlib 幾乎壓不動). 而且全程只用單一 browser 循序截圖.
- **權限確認等待**: session 為 `acceptEdits` 模式, workspace 只允許 `Bash(uv run .claude/skills/cinematic-video/scripts/*)`. agent 實際下的指令幾乎都對不上: `cd ... &&` 前綴、shell 變數 (`R=...; uv run $R`)、`for` 迴圈、直接呼叫 ffmpeg、critic 用 PowerShell 加絕對路徑、scratch 寫到 `%TEMP%`. 依官方文件, 複合指令的每個子指令都要各自符合規則, 變數賦值會讓比對失效, PowerShell 有獨立的 `PowerShell(...)` 規則, acceptEdits 只自動核准 working directory 內的寫入. 可量測的等待至少 14 分鐘 (例如 critic 的 `analyze_video.py` 實際 2.5 秒, 卻花了 78–159 秒).
- render guard 擋下輸出到 `out/` 的全長 render, 連 960×540 animatic 也被擋, agent 只好分兩段 render 再接起來, 指令與權限確認都變多.

## Decision

**render.py**
- 截圖改用 CDP `Page.captureScreenshot` 加 `optimizeForSpeed: true`: 仍是無損 PNG, 實測與 `page.screenshot` 像素完全相同 (兩個頁面、14 個時間點), 每格 509ms → 151ms.
- `--workers N` (預設 `min(4, CPU 邏輯核心數 / 2)`): 把影格切成 N 段連續區間, 每段由 spawn 出來的 process 各開一個 browser 與 ffmpeg 編成片段, 再用 concat demuxer `-c copy` 無損接合, 音訊在接合時一併 mux. `--workers 1` 直接寫出 (含音訊), 行為與舊版相同. 進度以共享計數器彙整, `--progress-file` 格式不變.
- 平行切段之所以安全, 是因為 non-negotiable #2 (畫面是時間的純函數); motion blur 的 subframe 分組在每段都從影格邊界開始, 所以不受影響.
- `--still` 可以一次給多個時間點, 共用一次頁面載入; 多個時輸出為 `<out>-t<T>.png`, 與 `--seek-test`、`analyze_video.py --frames` 的命名一致.

**指令形式與權限**
- `SKILL.md` 規定: 每個 script 都是獨立的一個指令, 從 working directory 執行, 不用 `cd`、變數、迴圈或 `&&`; 改用 script 自己的批次參數; scratch 放在專案內; studio workspace 中 `<skill>` 寫成 `.claude/skills/cinematic-video`.
- `init.mjs` 產生的 allowlist 補上 `PowerShell(uv run .claude/skills/cinematic-video/scripts/*)`.
- `analyze_video.py` 新增 `--crop W:H:X:Y`, 讓 critic 放大細節時不必直接呼叫 ffmpeg. critic prompt 結尾一律附上 Commands 段落.
- animatic 改寫到 `qa/animatic.mp4`, 一次完整 render, 不經過只管 `out/` 的 render guard. guard 的邏輯不變.

實測: 同一支 30 秒 1080p 影片, render 從約 7 分 47 秒降到 51 秒; 與原本輸出的 PSNR 平均 46.3 dB (兩次 crf 16 編碼的正常差異). 逐格正確性由 `--crf 0` 無損的單一 / 多 worker framemd5 比對測試保證.

## Impact

- `scripts/render.py`、`tests/test_render.py` (平行逐格一致、平行加音訊、多張 stills、單張 still).
- `scripts/analyze_video.py`、新增 `tests/test_analyze_video.py`, `package.json` test script.
- `studio/init.mjs`、`studio/test/init.test.mjs`.
- `studio/mod/register.ts` 協定 (animatic 寫到 qa/)、`studio/mod/guard.test.ts` (從 workspace 根目錄執行的指令: qa/ animatic 放行, out/ 全長 render 仍被擋).
- `SKILL.md`、`references/critic-prompts.md`、`references/gauntlet.md`、`references/treatments.md`、`templates/component-lab.html`.
- 已建立的 workspace 不會自動更新 `.claude/settings.json`, 需要重新 init 或手動補上 PowerShell 規則.

## Alternatives

- **JPEG 截圖**: 每格 49ms, 比快速 PNG 再快 3 倍, 但是有損, 再經 H.264 會二次失真. 正式成片不能接受; 草稿用途目前的速度已經足夠, 不另外加 flag.
- **單一 browser 開多個 page (async API)**: 省去多次啟動 browser, 但同一個 renderer 的 CPU 平行度有限, 程式也較複雜. 不採用, 改用 process 隔離.
- **allowlist 直接放行 `ffmpeg *` / 絕對路徑萬用字元**: 最省事, 但 ffmpeg 可以覆寫任意檔案, 萬用字元前綴也會放行專案外的同名 script. 不採用, 改以 script 參數 (`--crop`、多個 `--still`) 涵蓋需求, allowlist 維持只放行 skill 自己的 scripts.
- **SKILL.md `allowed-tools`**: 依文件, 授權只在呼叫 skill 的那個回合有效; web 模式每個 gate 回覆都是新訊息, 授權會失效, 而且不確定是否套用到 subagent. 不採用.

## Follow-up

- 用 playground 重新跑一次, 確認 critic 與主線程都不再出現權限確認 (studio 的 permission 提示不再出現).
- 觀察 WebGL / Three.js 頁面在 4 個 worker 下的記憶體與 GPU 使用量, 必要時調整預設值.
- 既有 workspace 的 settings 遷移方式 (例如 `/studio` 啟動時檢查並提示), 視需要另開 change.
