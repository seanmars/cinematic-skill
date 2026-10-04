# v1 測試策略: studio 用 vitest, mod 用 claude plugin test, brief 產生器用 pytest

## Status

- proposed
- Date: 20261004_015829

## Context

repo 目前沒有任何測試,也沒有 pyproject;`skills/cinematic-video/scripts/` 底下的 Python 腳本都用 uv inline 宣告依賴.web studio 會新增三種不同執行環境的程式碼:

- studio: Node/Vite.
- mod: 在 Claude Code 自己的 hooks 環境執行,沒有 DOM 也沒有 Node.官方提供 `claude plugin test` 和 `claude plugin validate` (plugin-authoring reference).
- brief 產生器: uv Python script.

最容易出錯的地方是跨程序的協定: 狀態檔的讀寫與容錯、指派、喚醒是否只送出一次,以及 brief 的產生.

## Decision

三個部分各自使用原生的測試工具:

- **studio**: vitest,測試狀態檔讀寫與讀到寫一半時的容錯、INDEX.md 解析、request-guard、指派與重新指派邏輯、fixture 的 schema 驗證、gitignore 陷阱檢查.
- **mod**: `claude plugin test` (`*.test.ts`) 加上 `claude plugin validate`,測試只處理指派給自己的專案、只送出一次 (`deliveredAt`)、心跳寫入,以及 gate 工具.
- **brief 產生器**: pytest,透過 uv inline 執行,測試從 storyboard.json 和 fixture 產生的 brief.md 是否符合範本結構,以及檔頭和技巧欄位轉成文字的結果.
- **UI 的 e2e 測試延後**.

選擇理由: 每個執行環境用自己原生的工具,不需要額外的轉接層;測試集中在跨程序協定這種最容易出錯的地方.

## Impact

- studio 加入 vitest 設定.
- mod 的 `*.test.ts`.
- `scripts/` 的 pytest 測試 (uv inline).
- 根目錄 `pnpm test` 串起三種測試.

## Alternatives

- **再加上 Playwright e2e**: 能涵蓋完整的 gate 操作,但 v1 的工作量明顯變多.延後.
- **只測 studio 核心邏輯**: 最快,但 mod 的喚醒、送出一次這些關鍵邏輯沒有測試保護.不採用.

## Follow-up

1. 設定 vitest 和根目錄的 `pnpm test`.
2. 建立 mod 測試的結構.
3. 建立 brief 產生器的 pytest.
4. (之後) Playwright e2e.

## Related Changes

## Decision Process

**Q:** v1 的測試範圍?(repo 目前完全沒有測試)

三個部分各用自己的測試工具,UI e2e 延後.
