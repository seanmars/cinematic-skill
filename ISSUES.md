# Issue

整個 session 會過於冗長導致 context 到後面會太過於龐大,
可能要考慮每個part結束就撰寫handoff文件,或者現有文件已經可以作為handoff文件,
然後每一part結束後就自動 /clear context 再開始進入下一個part, 但這樣會導致 session 關閉重開, web studio 那邊可能需要做一些調整.