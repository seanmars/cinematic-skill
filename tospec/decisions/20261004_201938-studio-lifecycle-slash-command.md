# studio 生命週期: mod 的 /studio 指令啟停, 最後一個 session 離開時自動停止

## Status

- proposed
- Date: 20261004_201938

## Context

目前使用 web studio 要開兩個 terminal: 先在 workspace 執行 `pnpm install` 與 `pnpm dev` (前景的 Vite server),再開另一個 terminal 執行 `claude`;結束時也要分別按 Ctrl+C 和 `/exit`.順序和步驟都不方便.

這個決定取代 `20261004_015829-studio-init-dev-loop.md` 中與啟動有關的部分: workspace 的 dev script、repo 根目錄的 `pnpm dev`,以及 init 下一步指示中的安裝與啟動指令.該決定的 init 兩種模式、依賴單一來源、playground 與 fixtures 仍然有效.

從 mod API (`claude-code.d.ts`) 確認的限制:

- mod 可以用 `$.command.register` 註冊 slash command,由 `command.run` hook 直接執行,不經過模型,也沒有權限提示.
- `$.process.run` 只能執行一次性的指令 (會等 process 結束,最多 10 分鐘),不能直接用來啟動長時間執行的 server.
- `session.end` 在 exit、`/clear`、resume、logout、signal 時都會觸發,大約只有 1.5 秒;`kill -9` 不會觸發.`/clear` 與 resume 之後 process 會繼續執行.
- 同一個 workspace 可以同時有多個 session (assignment / reassign).mod 一啟動就會寫入 `node_modules/.cinematic-studio/sessions/`,所以 `node_modules` 存在不代表已經安裝依賴.

## Decision

studio 的啟動與停止改由 studio mod 管理,使用者流程變成: 在 workspace 開 `claude` → `/studio start`.

**指令**: mod 註冊 `/studio`,參數是 `start | stop [--force] | status`;不帶參數時等於 `status`.只在 init 過的 workspace 出現 (沿用 `studio.config.json` 標記).

**start**
- 狀態檔 (`node_modules/.cinematic-studio/server.json`,記錄 pid 與實際網址) 中的 studio 還活著 (pid 存在而且 port 有回應) → 沿用,只顯示網址.已經死掉 → 清除狀態檔再啟動.
- 一般模式缺少依賴 (看 studio 套件是否已安裝,不看 `node_modules` 目錄) → 自動執行 install (優先使用 pnpm,沒有就用 npm).link 模式 → 不安裝,提示開發者到 repo 執行 `pnpm install`.
- 由 launcher 以 detached 方式啟動 server,log 寫到檔案;launcher 等 server 寫出實際網址 (port 可能不是 5173) 後才結束並回報.
- 只有真的啟動了新的 studio 才自動開啟瀏覽器.

**stop**: 其他 session 還在線上時拒絕,並列出那些 session;加 `--force` 才停止.

**自動停止**: `session.end` 的 reason 是 `prompt_input_exit`、`logout` 或 `other` (不包含 `clear`、`resume`),而且沒有其他線上 session 時,停止 studio.不做 server 端的閒置監看;同時 exit 或 `kill -9` 留下的 process,交給下次 `/studio start` 沿用,或用 `/studio stop` 清除.

**提示**
- status line 顯示 `studio xxxxxx` 加上 studio 的網址或「未啟動」,其他 session 啟動或停止 studio 後也會更新.
- Claude 開 gate 時如果 studio 沒在執行,提醒使用者執行 `/studio start`.

**移除 `pnpm dev`**: workspace 的 `package.json` 只保留依賴,拿掉 dev script;拿掉 repo 根目錄的 `pnpm dev`.init 的下一步指示改成 `cd <dir>` → `claude` → 接受信任 → `/studio start`.

選擇理由: slash command 由 mod 直接執行,結果穩定而且不花模型回合;studio 本來就只在 mod 有載入的 workspace 才能運作,所以指令只出現在那裡並不是限制.「最後一個 session 離開才停止」符合多 session 的設計,不會因為一個 session 離開,讓另一個 session 的 gate 失去網頁.只保留一種啟動方式,文件和使用者的心智模型都比較單純.

## Impact

- `studio/mod/register.ts`: 註冊 `/studio` 與 `command.run` hook、`session.end` 停止邏輯、status line 更新、開 gate 時的提醒.
- 新增 launcher (啟動 detached server、等待網址、寫入 `server.json`) 與停止邏輯;`dev.mjs` 改為 launcher 啟動的 server 入口,並在 listen 後寫出實際網址.
- `studio/init.mjs`: workspace `package.json` 拿掉 dev script,下一步指示改寫,pnpm/npm 偵測移到 install 步驟.
- repo 根目錄 `package.json` 拿掉 `dev` script.
- spec: `studio-workspace` 中 init 前置檢查 (下一步指示) 與 init 設定檔的 requirement 要修改,並新增 studio 生命週期的 requirement.
- 文件: README、`docs/web-studio-manual-test.md` 的啟動與結束步驟.
- 測試: mod 的 fake engine 測試 (指令、session.end 的 reason 篩選與多 session 判斷)、launcher 與狀態檔的 vitest.
- 併入進行中的 change `add-web-studio`.

## Alternatives

- **寫成 SKILL.md skill,由 Claude 透過 Bash 執行**: 在任何目錄都看得到,但每次都要經過模型回合、可能有權限提示,結果也比較不固定.不採用.
- **由啟動 studio 的 session 負責停止**: 規則比較單純,但其他還在工作的 session 會突然沒有 studio 可以用.不採用.
- **server 端閒置監看作為備援** (一段時間沒有線上 session 就自己結束): 可以涵蓋同時 exit、`kill -9` 的情況,但要多寫程式碼;改用「下次 start 沿用殘留 process」來補償.不採用.
- **保留 `pnpm dev`** (不受管理,或一樣受管理): 開發時可以直接看 log,但會有兩種啟動方式要維護和說明.不採用.
- **缺少依賴時只顯示錯誤**: 符合 init 不安裝依賴的原則,但使用者還是要多執行一個指令.不採用.
- **start 遇到已在執行的 studio 時一律重新啟動**: 能保證執行的是最新程式碼,但正在使用的 session 網頁會斷線一下.不採用.
- **另開 change**: 結構比較乾淨,但 add-web-studio 的手動驗證要用新的流程跑,所以併入.不採用.

## Follow-up

1. **Spike**: 在 Windows 上確認從 `$.process.run` 啟動的 detached server,在啟動它的 claude 結束後還能存活 (Claude Code 是否用 Job Object 結束子 process),以及 launcher 結束後 `$.process.run` 會立刻返回.如果不能存活,就要重新檢討「最後一個 session 才停止」.
2. 確認停止動作可以在 `session.end` 約 1.5 秒內完成 (Windows 需要結束整個 process tree).
3. 實作 launcher、`server.json`、`/studio` 指令、`session.end` 停止邏輯、status line 與開 gate 時的提醒.
4. 修改 init、repo 根目錄的 scripts、README、手動測試文件.
5. 在 add-web-studio 加入對應的 task 與 spec delta,手動驗證 (1.4、9.2 等) 改用新的流程.

## Related Changes

## Decision Process

**Q:** 啟動和停止要做成 mod slash command,還是 SKILL.md skill?

mod slash command.

**Q:** 同一個 workspace 有多個 claude 時,哪一個 exit 才停止 studio?

最後一個線上 session 離開時.

**Q:** 範圍要不要包含建立 workspace (init)?

不包含,init 維持一次性.

**Q:** 啟動時缺少依賴要怎麼處理?

一般模式自動 install;link 模式不安裝,提示到 repo 執行 `pnpm install`.

**Q:** 要不要讓 server 在沒有線上 session 時自己結束,當作備援?

不要,只靠 `session.end`.

**Q:** 現有的 `pnpm dev` 要怎麼處理?

移除,一律使用 `/studio`.

**Q:** 指令名稱?

`/studio start|stop|status`.

**Q:** 要提供哪些便利功能?

自動開啟瀏覽器、status line 顯示網址、開 gate 時提醒啟動.

**Q:** start 遇到已在執行的 studio 怎麼辦?其他 session 在線上時 stop 怎麼辦?

沿用並顯示網址;stop 拒絕,加 `--force` 才停止.

**Q:** 要另開 change 還是併入 add-web-studio?

併入 add-web-studio.

**Q:** (重述確認) 整體需求與排除項目?

正確.
