# studio-workspace Specification

## Purpose
讓使用者用一個 init 指令建立可以執行 web studio 的 workspace,並讓本 repo 的開發者用連結原始碼的方式熱重載 skill、mod 與 studio.

## Requirements

### Requirement: init 的前置檢查
init SHALL 只在目標目錄不存在或為空時建立 workspace;目標目錄已有非隱藏檔案時,除非使用者加上 force 選項,否則 SHALL 拒絕執行.寫入任何檔案前,init SHALL 檢查 Node 版本是否符合 studio 的需求.init SHALL NOT 安裝依賴,下一步指示也 SHALL NOT 列出安裝依賴或啟動 studio 的指令,而是 SHALL 說明在該目錄開啟 Claude Code、接受 workspace trust 後執行 `/studio start` (依賴由 `/studio start` 安裝).

#### Scenario: 目標目錄不存在
- **WHEN** 使用者對一個不存在的目錄執行 init
- **THEN** init 建立該目錄並完成 workspace 的所有檔案
- **AND** 印出下一步指示 (在該目錄開啟 Claude Code、執行 `/studio start`),其中沒有安裝依賴或啟動 dev 的指令

#### Scenario: 目標目錄非空且沒有 force
- **WHEN** 使用者對一個含有非隱藏檔案的目錄執行 init,且沒有加 force
- **THEN** init 不寫入任何檔案並以錯誤結束,訊息說明可以加上 force 選項

#### Scenario: Node 版本不足
- **WHEN** 使用者的 Node 版本低於 studio 的需求
- **THEN** init 不寫入任何檔案並以錯誤結束,訊息列出需要的版本

#### Scenario: 沒有安裝 pnpm
- **WHEN** 系統找不到 pnpm
- **THEN** init 照常完成,下一步指示與有 pnpm 時相同,不提到任何 package manager

### Requirement: 一般模式把 skill 複製到 project 層
一般模式的 init SHALL 把執行中的 skill 整個複製到 workspace 的 project 層 skill 資料夾 (Claude Code 的 `.claude/skills/cinematic-video`),並 SHALL 排除 node_modules、Python 快取與 manifest 路徑.

#### Scenario: 複製時排除快取與依賴
- **WHEN** skill 目錄裡有 node_modules 或 Python 快取目錄
- **THEN** workspace 內的 skill 副本不包含這些目錄
- **AND** skill 的其他檔案 (SKILL.md、references、scripts、schema、studio 原始碼) 都完整複製

### Requirement: mod 的 manifest 只在 workspace 產生
init SHALL 在 workspace 的 skill 副本內產生 mod 的 plugin manifest 與 workspace 標記,讓在該 workspace 啟動、並接受 workspace trust 的 Claude Code 自動載入 mod;散佈出去的 skill 本身 SHALL NOT 包含 manifest.mod 在沒有 workspace 標記的目錄中 SHALL NOT 啟用任何功能.

#### Scenario: 在 workspace 啟動 Claude Code
- **WHEN** 使用者在 init 建立的 workspace 內啟動支援 function hooks 的 Claude Code
- **THEN** 使用者接受 workspace trust 後,studio mod 在同一個 session 自動載入,不需要額外的啟動參數

#### Scenario: 全域安裝的 skill
- **WHEN** 使用者透過 skills 安裝工具把 skill 安裝到全域,並在任意目錄啟動 Claude Code
- **THEN** studio mod 不會被載入,skill 以 CLI 模式運作

### Requirement: init 產生 workspace 的設定檔
init SHALL 產生 workspace 的 package.json (studio 依賴,依賴清單來自 studio 自己的依賴宣告;SHALL NOT 包含 dev 指令或其他 script)、Claude Code 專案設定 (預先允許 studio mod 工具與 skill 的 uv 腳本,並設定權限提示時記錄等待狀態的 Notification hook)、gitignore (不排除 video 下的 studio 狀態目錄),以及空的 video 目錄;init SHALL NOT 產生 MCP 設定檔.

#### Scenario: 產生的依賴與 studio 宣告一致
- **WHEN** init 產生 workspace 的 package.json
- **THEN** 其中的 studio 依賴與版本和 studio 自己的依賴宣告完全一致
- **AND** package.json 沒有任何 script

#### Scenario: Claude 等待權限授權
- **WHEN** workspace 內的 Claude Code 出現權限提示
- **THEN** Notification hook 在暫存目錄寫入該 session 正在等待授權的紀錄

### Requirement: link 模式供本 repo 開發使用
link 模式的 init SHALL 在目標 workspace 建立指向 repo 內 skill 原始碼的連結 (Windows 使用 junction,其他平台使用 symlink),並 SHALL 把 manifest 產生在原始碼目錄中已被 gitignore 的路徑;link 模式 SHALL NOT 產生 package.json 或安裝依賴.

#### Scenario: 修改原始碼後立即生效
- **WHEN** 開發者用 link 模式建立 playground,並修改 skill 原始碼中的 SKILL.md 或 mod
- **THEN** playground 內的 Claude Code 不需要重新 init 就使用修改後的內容

#### Scenario: manifest 不會被散佈
- **WHEN** link 模式在原始碼目錄產生 manifest
- **THEN** git 不追蹤這些 manifest 檔案
