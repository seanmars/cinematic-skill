# 長時間作業的即時進度: mod 活動紀錄 + render.py 進度檔

## Status

- proposed
- Date: 20261004_021550

## Context

Claude 工作時,網頁是唯讀的,只能看到「工作中」.render.py 是 Claude 在 Bash 裡執行的,可能要跑好幾分鐘,而且加上 motion blur 時間會變成 4 倍.它的輸出只有 Claude 看得到.Critic subagent 的審查也很花時間.另外,網頁要播放 `out/final.mp4` 並能拖曳時間軸,靜態 server 就必須支援 HTTP Range.

mod 的 `tool.call` hook 可以在每次工具呼叫的前後執行,不需要模型配合.

## Decision

- **mod 活動紀錄**: mod 用 `tool.call` 記錄每個工具呼叫的開始、結束和簡短摘要 (例如「正在執行 render.py」「正在派出 storyboard critic」),寫進自己的 session 檔 (`node_modules/.cinematic-studio/sessions/<sessionId>.json`).網頁可以顯示「Claude 目前在做什麼」.
- **render.py 進度檔**: 新增 `--progress-file <path>`,定期寫入目前幀數、總幀數和 ETA.web 模式由協定要求 Claude 帶上這個參數,檔案放在 `node_modules/.cinematic-studio/`.CLI 模式不受影響.
- **Range**: studio 的靜態 server 要支援 HTTP Range,影片才能拖曳播放.

選擇理由: 活動紀錄由 mod 自動產生,不會因為模型忘了回報而漏掉;百分比進度只有 render.py 自己知道,所以由它寫出.兩者都是單一寫入者.

## Impact

- mod: `tool.call` 的活動紀錄.
- `scripts/render.py`: 新增 `--progress-file`.
- studio: 活動面板、render 進度條、支援 Range 的靜態 server.
- mod 注入的協定: web 模式下要帶上 `--progress-file`.

## Alternatives

- **只有 mod 活動紀錄**: 不用改 render.py,但網頁上沒有百分比和剩餘時間.不採用.
- **不顯示進度**: 實作最少,但長時間 render 時,使用者不知道還要等多久.不採用.

## Follow-up

1. 定義活動紀錄的格式和保留筆數.
2. 實作 render.py 的 `--progress-file` (寫入頻率、原子寫入) 並寫測試.
3. 實作 studio 的活動面板和進度條.
4. 靜態 server 支援 Range.

## Related Changes

## Decision Process

**Q:** 長時間作業的進度要怎麼顯示在網頁上?

mod 活動紀錄 + render.py 進度檔.

**Q:** (重述確認) 進度檔放在 `node_modules/.cinematic-studio/`?

正確.
