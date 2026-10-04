# 審查輪數依 profile 並設上限

## Status

- accepted
- Date: 20261004_224827

## Context

playground 實測一支 30 秒 stylized 咖啡店短片 (`F:/workspace/try/playground-video`, 2026-10-04 19:31 起), 到最終 render 完成約花了 3 小時. 從 session transcript 量測:

- 頭條「字窗」元件跑了 1 輪 component critic + 4 輪 verification, 每輪 critic 12–16 分鐘, 整個元件迴圈 (20:37–22:05) 約 90 分鐘.
- 主線程派出 critic 後就停下來等, 累計閒置 67 分鐘.
- 規則互相矛盾: `SKILL.md` step 6 要求**每個**自訂元件拿到 component critic 的 KEEP, 但 `gauntlet.md` 寫 stylized 只需 Storyboard、Full film、Verification 三種審查; 同時 `gauntlet.md` 的停止條件是「通常 3–5 輪」, 沒有上限, `brief.py` 產生的 brief 也寫「run the Gauntlet until the quality bar holds」.

## Decision

- **依 profile 決定審查種類**: stylized 只跑 Storyboard、Full film、Verification; 元件在 lab 中以 builder 自己的 stills 檢查, 由 full-film critic 在成片中評判. commercial 維持全部五種 (含 Asset、Component).
- **每個審查對象 (storyboard、元件、成片) 最多 1 輪 critic + 1 輪 verification.** verification 之後仍被指出的項目由 builder 自行修正並以 stills 確認, 在交付說明中標為 self-checked. 要不要再審一輪由使用者決定 (web 模式為 gauntlet gate 的 another-round).
- **critic 審查期間不閒置**: builder 繼續做 critic 沒在看的部分 (後續鏡頭、音訊、交付說明).
- `quality-bar.md` 從「全部達標才能交片」改為「每輪審查的檢查基準; 最後一輪仍未達標的項目列為已知不足」.

## Impact

- `skills/cinematic-video/SKILL.md`: step 6 元件審查依 profile, step 9 Gauntlet 停止條件與不閒置.
- `references/gauntlet.md` rule 3、rule 7、Round Types; `references/quality-bar.md` 開頭; `references/three-js-patterns.md` Lab First; `templates/component-lab.html` 註解.
- `scripts/brief.py` 的 `BUILD_LABS`、`START` 固定文字, 與 `references/brief-template.md` 同步 (`tests/test_brief.py` 檢查兩者一致). 既有專案的 `brief.md` 要重新產生才會帶到新文字.
- `studio/mod/register.ts` web 協定中 build-animatic / build-polish payload 的 critic 說明 (stylized 填自己的 stills 檢查).
- `docs/cinematic-video-guide.html` 範例的審片輪次.

## Alternatives

- **保留元件 critic, 每個元件限 2 輪**: 所有 profile 都跑元件 critic, 但 critic + 1 輪 verification 為止. 對 stylized 仍多一個 12–16 分鐘以上的迴圈, 而 stylized 的元件問題 full-film critic 一樣看得到. 不採用.
- **只設總上限 3 輪**: 維持現有結構, 只把「3–5 輪」改成最多 3 輪. 省下的時間最少, 也沒有解決 SKILL.md 與 gauntlet.md 的矛盾. 不採用.
- **維持現狀 (到品質標準為止)**: 品質上限最高, 但時間無上限, 這次單一元件就花了約 90 分鐘. 不採用.

## Follow-up

- 用 playground 從頭跑一支 stylized 短片, 確認流程中沒有 component critic, 每個審查對象只有 critic + verification, 並記錄總時間與這次的 3 小時對照.
- 觀察 commercial 案例在 2 輪上限下的成品品質; 如果經常需要使用者要求再審一輪, 再檢討上限.

## Decision Process

**Q:** critic 審查迴圈要怎麼限制? (依 profile + 上限 / 保留元件 critic 限 2 輪 / 只設總上限 3 輪)

依 profile + 上限: stylized 不跑元件 critic, 元件問題併入 full-film 輪; 每個審查對象最多 1 輪 critic + 1 輪 verification, 未解決項目寫進交付說明, 再一輪由使用者決定.
