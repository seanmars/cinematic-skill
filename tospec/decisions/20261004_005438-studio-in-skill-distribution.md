# studio 放在 skill 目錄內, 以 init 腳本建立 workspace, 不發佈 npm

## Status

- proposed
- Date: 20261004_005438

## Context

這個 repo 目前是純 skill,透過 `npx skills add seanmars/cinematic-skill` 散佈,工具鏈是 uv + FFmpeg.web studio 需要 Node,而且 web 模式的協定 (mod 工具、storyboard.json schema) 必須跟 studio 版本對齊.

grill 查證: skill 優先順序是 Personal > Project (官方 skills.md),全域安裝的 SKILL.md 會蓋過 workspace 副本,所以「複製 skill 就能對齊版本」不成立;協定改由 mod 的 `prompt.compose` 注入 (見 `20261004_012329-studio-mod-bridge.md`).另外,project 層 `.claude/skills/<name>` 內的 plugin 會被自動載入 (`reference.md:68`).

open-slide 的做法是發佈兩個 npm 套件: `@open-slide/cli` 負責 `init` scaffold,`@open-slide/core` 是 runtime + `dev`.skill 在 build 時鏡像進 template,init 再把 skill 複製進使用者的 workspace (`.agents/skills` + `.claude/skills` 連結,Windows 上改用複製),升級時用 `sync:skills` 同步並偵測 drift.

## Decision

- studio (Node/Vite) 放在 `skills/cinematic-video/studio/`,跟著 `npx skills add` 一起散佈,**不發佈 npm**.
- `init` 是 skill 內的腳本,**只建立新目錄** (非空目錄要加 `--force`,跟 open-slide 一樣).它會:
  - 把整個 skill (含 studio 和 mod 原始碼) 直接複製到 `.claude/skills/cinematic-video` (mod 只能在 Claude Code 使用,不需要 `.agents/skills` 和連結,也一併避開 Windows symlink 的問題).
  - **只在 workspace 內**產生 mod 的 plugin manifest (`.claude-plugin/plugin.json`、`hooks/hooks.json`),讓 project 層自動載入.散佈版的 skill 不帶 manifest,所以全域安裝不會啟動 mod.
  - 寫入 `package.json` (dev script 指向 workspace 內 skill 副本的 studio,以及 studio 的依賴)、`.claude/settings.json` (allowlist + Notification hook)、`.gitignore` 和 `video/`.不產生 `.mcp.json`.
- web 模式需要 Node + pnpm;CLI 模式一樣只需要 uv + FFmpeg.
- 本 repo: 根目錄 `package.json` 用 `pnpm dev` 直接拿 studio 原始碼跑 gitignore 的 `playground/` (類似 open-slide 的 `apps/demo`),現有的 `video/` 搬進 playground.init 的兩種模式 (一般模式和 `--link`)、依賴來源和 fixtures,詳見 `20261004_015829-studio-init-dev-loop.md`.
- v1 不做 workspace 內 skill 副本的自動同步.

選擇理由: 維持單一散佈管道.複製 skill 讓 dev script 的路徑固定,studio 跟 mod 的版本也一定對齊.協定由 mod 注入,所以就算 SKILL.md 被全域版蓋過,也不會影響 web 模式.

## Impact

- 新增 `skills/cinematic-video/studio/` (studio 原始碼和 init 腳本).
- 新增根目錄 `package.json` 和 `.gitignore` 的 `playground/` 規則.
- README 的需求和安裝說明加上 web 模式.

## Alternatives

- **發佈 npm,完全照 open-slide**: 版本管理和 `sync:skills` 現成可用,但多一個散佈管道和發佈流程.不採用.
- **dev script 指回原本的 skill 安裝路徑**: skill 更新會自動跟上,但 skill 搬家或重裝就會壞,也不能跨機器使用.不採用.
- **init 可在既有目錄只補缺的檔案**: 這個 repo 本身也能直接 init,但合併邏輯比較複雜.不採用,改成只建立新目錄.
- **不加根目錄 dev,用 init 外部 workspace 來測**: repo 結構最單純,但開發迴圈太慢.不採用.

## Follow-up

1. Spike: 全域有同名 skill (沒有 manifest) 時,project 層 skill 資料夾裡的 plugin 是否仍會自動載入 (優先順序已查證為 Personal > Project).
2. 實作 init 腳本 (複製 skill、產生 manifest 和 settings、`--force`).
3. 建立根目錄 dev 迴圈和 playground.
4. 更新 README.
5. (v2) workspace 內 skill 副本的同步機制.

## Related Changes

## Decision Process

**Q:** web studio 的技術棧和散佈方式?

Node/Vite app 放在 skill 目錄,用 pnpm dev 啟動.

**Q:** 使用者專案的 MCP 註冊由誰處理?

像 open-slide 一樣,做一個 `init` CLI 處理.

**Q:** 要照 open-slide 發佈 npm 套件嗎?

不發佈 npm,init 是 skill 目錄內的腳本.

**Q:** init 遇到已經有東西的目錄怎麼處理?

只建立新目錄,跟 open-slide 一樣.

**Q:** workspace 要怎麼參照 skill 和 studio?

複製整個 skill 進 workspace.

**Q:** 這個 repo 本身要怎麼開發?

根目錄 `pnpm dev` 搭配 gitignore 的 `playground/`.

**Q:** (grill) workspace 要怎麼載入 mod?

由 init 直接產生 project 層級的 skill 和 plugin mod;manifest 只由 init 產生,並直接複製到 `.claude/skills`,不再使用 `.agents/skills`.
