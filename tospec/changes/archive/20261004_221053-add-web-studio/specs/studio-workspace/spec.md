## MODIFIED Requirements

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

### Requirement: init 產生 workspace 的設定檔
init SHALL 產生 workspace 的 package.json (studio 依賴,依賴清單來自 studio 自己的依賴宣告;SHALL NOT 包含 dev 指令或其他 script)、Claude Code 專案設定 (預先允許 studio mod 工具與 skill 的 uv 腳本,並設定權限提示時記錄等待狀態的 Notification hook)、gitignore (不排除 video 下的 studio 狀態目錄),以及空的 video 目錄;init SHALL NOT 產生 MCP 設定檔.

#### Scenario: 產生的依賴與 studio 宣告一致
- **WHEN** init 產生 workspace 的 package.json
- **THEN** 其中的 studio 依賴與版本和 studio 自己的依賴宣告完全一致
- **AND** package.json 沒有任何 script

#### Scenario: Claude 等待權限授權
- **WHEN** workspace 內的 Claude Code 出現權限提示
- **THEN** Notification hook 在暫存目錄寫入該 session 正在等待授權的紀錄
