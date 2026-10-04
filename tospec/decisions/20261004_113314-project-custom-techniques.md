# 技巧欄位可引用專案自訂技巧檔, 找不到時 brief.py 以失敗結束

## Status

- proposed
- Date: 20261004_113314
- 擴充 `20261004_014759-storyboard-schema-technique-slots.md`: 技巧欄位不再只能引用 skill 技巧庫.

## Context

`20261004_014759-storyboard-schema-technique-slots.md` 規定 storyboard 的技巧欄位一律引用 skill 技巧庫 (`references/techniques/<category>/<slug>.md`,424 個技巧).add-production-data 的 design D4 規定 brief.py 讀不到技巧檔時,改用 slug 轉成名稱.

add-production-data 的 CLI 實測 (由一個全新 context 的 subagent 依 SKILL.md 製作 `video/morning-steam`) 回報: brief.py 不檢查技巧路徑,路徑寫錯時會「悄悄 fallback 成 slug」,不會報錯.subagent 只好自己用 jsonschema 驗證,並逐一檢查路徑.這代表以下兩種錯誤都會被吞掉,在 brief.md 裡變成一個看起來很合理的名稱:
- 打錯字,例如 `push-inn.md`.
- 模型自己編出技巧庫裡沒有的技巧.

使用者認為現實中還有許多技巧庫沒收錄的技巧 (或不同的名稱),應該要能接受新技巧: 技巧庫找不到就上網查,網路上也找不到就詢問使用者,討論實際的做法.

## Decision

- **專案自訂技巧檔**: 技巧庫沒有的技巧,寫成專案內的 `video/<slug>/techniques/<category>/<slug>.md`.格式和技巧庫相同 (frontmatter 包含 `name`、`category`、`slug`、`source`,內容寫摘要與做法).`source` 填網址,或標成「使用者」.category 必須是技巧庫既有的類別之一,所以四個主欄位的類別限制不變.
- **storyboard 欄位寫法不變**: 仍然是 `<category>/<slug>.md`.brief.py 依序在 skill 技巧庫、專案的 `techniques/` 中尋找.
- **找不到就失敗**: 兩處都沒有時,brief.py 會列出所有找不到的路徑並以失敗結束,不產生 brief.md.錯誤訊息會提示流程: 先確認是不是打錯字;如果是新技巧,就先上網查,查得到就寫成專案自訂技巧檔並附上來源;查不到就詢問使用者,討論實際的做法後再寫.
- **新技巧只留在專案**: 不修改 skill 的技巧庫.如果想把好的新技巧收進技巧庫,之後另開 change.
- **取代 add-production-data design D4 的 fallback** (讀不到就用 slug).

選擇理由: 新技巧必須「有一份說明檔」才算存在,所以打錯字會被擋下,真正的新技巧則會留下有來源、有做法的說明.critic 和之後網頁上的技巧選擇器,都能用同樣的方式對待新技巧和技巧庫裡的技巧.

## Impact

- `scripts/brief.py`: 增加查找順序與失敗處理.
- `references/shot-design.md`、SKILL.md Step 4: 加上新技巧的查證流程 (技巧庫 → 網路 → 使用者) 和專案自訂技巧檔的格式.
- storyboard schema 的欄位描述: 改成可以引用技巧庫或專案自訂技巧.
- add-production-data 的 spec 與 design 要更新;add-web-studio 的技巧選擇器也要列出專案自訂技巧.

## Alternatives

- **在 storyboard 欄位裡直接寫名稱與來源** (`{ name, source, notes }` 物件): 比較簡單,但沒有做法說明可以給 critic 和網頁使用,打錯字也抓不到.不採用.
- **不檢查,任何名稱都接受**: 最自由,但打錯字和編出來的技巧都分辨不出來.不採用.
- **照樣產生但印出警告**: 不會中斷流程,但警告容易被忽略,brief.md 仍然會寫進錯誤的名稱.不採用.
- **新技巧自動加進 skill 技巧庫**: 下一個專案就能直接使用,但會修改使用者那邊安裝的 skill,更新 skill 時也會被蓋掉.不採用.

## Follow-up

1. 更新 add-production-data 的 spec、design 與 tasks,並實作 brief.py 的查找與失敗處理,加上測試.
2. 更新 shot-design.md 與 SKILL.md 的新技巧流程說明.
3. 更新 add-web-studio: 技巧選擇器要包含專案自訂技巧.
4. (之後) 評估把專案中常用的新技巧收進技巧庫的流程.

## Related Changes

## Decision Process

**Q:** brief.py 遇到不存在的技巧路徑時要怎麼處理?(使用者先問「技巧」指的是什麼,說明後再問一次)

應該要能接收新的技巧,因為網路上或現實中可能有更多、甚至更新的技巧或名稱.skill 中找不到就從網路尋找,網路上也找不到就詢問使用者,討論實際的做法.

**Q:** 新技巧要用什麼方式記錄?

專案自訂技巧檔,找不到就失敗.

**Q:** 查到或討論出來的新技巧,要不要加進 skill 的技巧庫?

只留在專案裡,不改技巧庫.
