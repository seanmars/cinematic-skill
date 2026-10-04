# init 兩種模式與本 repo 的開發迴圈

## Status

- proposed
- Date: 20261004_015829

## Context

`20261004_005438-studio-in-skill-distribution.md` 決定由 init 把 skill 複製進新 workspace,`20261004_012329-studio-mod-bridge.md` 決定 mod 的 manifest 只能由 init 在 workspace 內產生,散佈版的 skill 不帶 manifest.第四輪 grill 討論 init 的細節和本 repo 的開發迴圈時,發現以下問題:

- **開發迴圈跟「manifest 只在 workspace 產生」衝突**: playground 要能熱重載,`.claude/skills/cinematic-video` 就必須連結到 repo 的 `skills/cinematic-video` 原始碼,但這樣 manifest 就得放在會被散佈出去的原始碼目錄裡.
- **`.gitignore` 是通用範本**: 會默默排除 `lib/`、`build/`、`dist/`、`out`、`var/`、`target/`、`parts/`、`downloads/`、`env/`.`npx skills add` 只從 GitHub 抓被 git 追蹤的檔案,被 ignore 的原始碼不會散佈出去.
- **依賴清單會漂移**: studio 的依賴同時出現在 repo 開發用的設定和 init 產生的 package.json,兩份很容易不一致.
- **沒有 fixture**: 開發 UI 時,每次都要讓 Claude 跑到對應的 gate 才能測.
- **package manager 偵測**: open-slide 用 `npm_config_user_agent` 判斷 (`packages/cli/src/package-manager.ts`),但我們的 init 是用 `node` 直接執行,不會有這個值.
- repo 目前沒有任何測試或 pyproject;`skills/cinematic-video/scripts/__pycache__/` 存在,但已被 ignore.

## Decision

**init** (`node <skill>/studio/init.mjs <dir> [--force] [--link]`):
- 用純 JS (ESM) 撰寫,不需要 build.執行前先檢查 Node 版本是否符合 Vite 需求;優先使用 pnpm,找不到就退回 npm.
- **一般模式**:
  1. 複製 skill 到 `<dir>/.claude/skills/cinematic-video`,排除 `node_modules`、`__pycache__` 和被 git ignore 的檔案.
  2. 產生 manifest.
  3. 依 `studio/package.json` 產生 workspace 的 `package.json`,並寫入 `.claude/settings.json` (allowlist + Notification hook)、`.gitignore` 和 `video/`.
  4. 印出下一步: `pnpm install && pnpm dev`,然後在該目錄開 `claude`.
- **`--link` 模式 (只給開發用)**:
  - 建立指向 repo `skills/cinematic-video` 的連結 (Windows 用 junction,其他平台用 symlink).
  - manifest 產生在原始碼目錄,但這些路徑已經加進 `.gitignore`,所以不會被 `npx skills add` 散佈出去.
  - 不產生 package.json,也不安裝依賴.

**本 repo 的開發迴圈**:
- `studio/package.json` 是依賴的**單一來源**.repo 用 pnpm workspace 安裝它的依賴,init 也是讀這一份來產生 workspace 的 package.json.
- 在 repo 根目錄執行 `pnpm dev`,studio 會以 `playground/` 為 cwd 執行.`playground/` 加進 gitignore,用 `init --link` 建立,現有的 `video/lunelle-promo` 搬進 playground.
- `fixtures/` 放在 repo 根目錄,不隨 skill 散佈.內容涵蓋 storyboard、treatments、gates、replies、progress,以及一個簡單的 index.html.playground 可以用它初始化;fixture 要用 JSON schema 驗證,避免跟 schema 脫節.
- **`.gitignore` 陷阱**: skill 原始碼不能使用上面列出的那些目錄名稱.要加一個檢查,確認 studio 原始碼除了 manifest 之外,沒有任何檔案被 git ignore.

選擇理由: `npx skills add` 只抓 git 追蹤的檔案,所以把 manifest 加進 gitignore,就能讓「開發時熱重載」和「散佈時不帶 manifest」同時成立.依賴只寫一份,就不會有開發環境和使用者環境版本不一致的問題.

## Impact

- 新增 `skills/cinematic-video/studio/init.mjs` 和 `studio/package.json`.
- repo 根目錄: `package.json`、`pnpm-workspace.yaml`、`.gitignore` (加入 playground/ 和原始碼中 manifest 的路徑)、`fixtures/`.
- 新增 gitignore 陷阱的檢查 (納入測試).
- README: 開發方式,以及 web 模式的需求 (Node + pnpm).

## Alternatives

- **playground 建立逐項連結的資料夾,manifest 留在 playground**: 原始碼完全不放 manifest,但不確定 Claude Code 能不能透過 symlink 偵測到檔案變動.不採用.
- **每次改完重新 init 複製**: 最單純,跟使用者環境一致,但沒有熱重載.不採用.
- **repo 根目錄和 init 範本各寫一份依賴**: 結構簡單,但兩份會漂移.不採用.
- **不做 fixture**: 不用維護假資料,但開發 UI 要依賴完整的 Claude 流程.不採用.

## Follow-up

1. **Spike**: 在 git repo 的子目錄 (`playground/`) 開 Claude Code 時,哪一個 `.claude/skills` 會被當成 project 層,並自動載入 plugin?(repo 根目錄也有一份從 GitHub 安裝的 `.claude/skills/cinematic-video`.) 備案是把 playground 移到 repo 外,或在 playground 裡另外 `git init`.
2. 實作 init.mjs 的兩種模式 (複製時的排除規則、junction/symlink、Node 版本和 package manager 檢查).
3. 建立 pnpm workspace、根目錄 `pnpm dev`、playground.
4. 建立 fixtures 和 schema 驗證.
5. 實作 gitignore 陷阱檢查.

## Related Changes

## Decision Process

**Q:** playground 要怎麼接到 skill 原始碼,才能改完馬上生效?

連結到原始碼,manifest 加進 .gitignore.

**Q:** studio 的依賴清單要寫在哪裡?

`studio/package.json` 寫一次,開發環境和 init 都從它取得.

**Q:** 開發 UI 時要不要有 fixture 專案?

提交一個 fixture 專案,不隨 skill 散佈.

**Q:** (重述確認) init 的預設值 (純 JS、Node 版本檢查、優先使用 pnpm、--link 不產生 package.json) 和 playground 專案根的 spike?

正確.
