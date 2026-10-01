# Hangman 單字遊戲

兩款用同一套引擎做的 Hangman 猜字遊戲。每款都是**一個 HTML 檔案**，資料已經內建，
開啟後完全不需要網路。

| | 釋義版 | 克漏字版 |
| --- | --- | --- |
| 提示 | 單字的英英釋義或中文解釋 | 一句生活化的克漏字例句，加上該語意的英文釋義 |
| 要拼的字 | 字庫裡的字 | **例句需要的形態**，可能是變化形 |
| 單字範圍 | 68,352 字 | 考試等級單字 12,608 字 |
| 線上玩 | 👉 **[釋義版](https://gjchentw.github.io/hangman/)** | 👉 **[克漏字版](https://gjchentw.github.io/hangman/hangman_cloze.html)** |
| 下載 | [`hangman.html`](hangman.html) | [`hangman_cloze.html`](hangman_cloze.html) |

---

## 開始遊戲

1. 開啟任一個 HTML 檔（直接雙擊即可，不需要架站）
2. 在文字框貼上想練習的單字，用**半形逗號、空白或換行**分隔：

   ```
   ability,serendipity cat
   hangman
   ```

3. 按「開始遊戲」。沒有提示可用的單字會列出來並自動排除，不會出現在測驗中
4. 按「開始猜字」進入遊戲

字庫會記在瀏覽器裡，下次開啟可直接「沿用上次字庫」。兩款遊戲的字庫與戰績分開保存；
發音設定則共用。

## 釋義版

- 內建 **68,352** 個單字、**119,854** 條英文釋義，以及 **100% 覆蓋**的正體中文解釋
- 中文 / EN 可隨時切換：EN 列出單字的**所有**語意，中文顯示完整詞典義

## 克漏字版

每一題從單字的語意中隨機挑一個，顯示為它寫的克漏字例句，並附上該語意的英文釋義。
例句用的是**文法上需要的形態**，而那個形態就是要拼的答案：

| 字庫裡的字 | 提示 | 要拼的答案 |
| --- | --- | --- |
| `expect` | She's `_________` a baby in June. | `expecting` |
| `fall` | The old regime finally `____` after years of protests. | `fell` |
| `mind` | He's one of the great `_____` of his generation. | `minds` |
| `plan` | We need a proper `____` before Monday. | `plan` |

- 字庫請輸入**原形**（`fall`，不是 `fell`）
- 空格的長度等於答案的長度，本身就是提示
- 同一個字每次可能考不同的語意與形態（這次 `fell`，下次 `falling`）
- 答錯或答對後，例句會補上答案，結果顯示 `fell ← fall`
- 發音按鈕唸的是答案，也就是句中的那個形態

題目涵蓋考試等級單字（中考、高考、CET4、CET6、研究所、TOEFL、IELTS、GRE），
依等級逐批撰寫，已涵蓋全部 12,608 個字、約 24,500 題。不在範圍內的字會列在「無題目」清單中。

情態助動詞（can、will、must…）沒有「助動詞」這個語意：題目依照 wordset 的語意撰寫，
而 wordset 裡的 `can` 是罐頭、`will` 是遺囑。`be`、`have`、`do` 則有一般動詞語意，
會依句子變化（`was`、`had`、`did`）。

## 操作方式

| 操作 | 說明 |
| --- | --- |
| 實體鍵盤 A–Z | 猜字母 |
| 螢幕鍵盤（QWERTY） | 點擊猜字母，同時顯示已猜過的字母 |
| 🔊 發音 | 唸出目前的答案 |
| 中文 / EN | 切換解釋語言，遊戲中隨時可切（僅釋義版） |
| 簡易 / 嚴格 | 切換猜字模式，遊戲中隨時可切 |
| 語音 / 音調 / 語速 | 調整發音，放開滑桿會立刻試聽 |
| 空白鍵 | 進行中：唸出答案；該題結束後：進入下一題 |
| Enter | 該題結束後進入下一題 |

## 遊戲規則

- 答案以底線表示：`_______`
- **答錯 6 次**就輸了，吊人圖會依序畫出頭、身體、雙手、雙腳
- 猜完所有字母就贏
- 連字號等非字母符號一開始就會顯示，不需要猜
- 每題結束後會停住並公布答案，按「下一題」才會繼續

### 兩種模式

**簡易模式**（預設）— 輸入字母，揭露該字母在答案中的**所有**位置：

```
答案 : ability
輸入 : i
結果 : __i_i__
```

猜過的字母會變色並停用；猜到不存在的字母才算錯。

**嚴格模式** — 必須依照**正確拼字順序**輸入，一次只揭露一個位置：

```
答案 : ability
輸入 : a → a______
輸入 : b → ab_____
輸入 : i → abi____
```

閃爍的游標標示下一個該輸入的位置。輸入的字母若不是下一個字母就算錯，**即使它存在於答案中**。
嚴格模式的字母不會被用掉，可以重複輸入（例如 `ability` 需要按兩次 `i`）。

語言與模式的選擇都會記在瀏覽器裡。

## 瀏覽器需求

資料以 gzip 內嵌，解壓縮需要 `DecompressionStream`：

- Chrome / Edge 80+
- Safari 16.4+
- Firefox 113+

發音需要瀏覽器提供英文語音；找不到時發音按鈕會停用，其餘功能不受影響。

## 專案結構

```
hangman.html                  釋義版成品（約 4.8 MB，含內嵌字典）
hangman_cloze.html            克漏字版成品（只含克漏字題庫）
tools/hangman.template.html   兩款遊戲共用的原始碼；__VARIANT__ 決定產出哪一款
tools/build_dict.py           同時產生兩個 HTML 檔
tools/build_zh.py             產生 tools/zh_dict.json（ECDICT → OpenCC → 修正 → 合併人工翻譯）
tools/zh_fixes.py             OpenCC 之後的台灣用語修正規則
tools/zh_manual.json          ECDICT 未收錄的 451 個單字，人工翻譯
tools/zh_dict.json            合併後的中文字典（建置產物，已納管以便免下載重建）
tools/build_inflections.py    從 ECDICT 產生 tools/inflections.json（考試單字的等級與變化形）
tools/inflection_supplement.json  ECDICT 缺少的變化形（am/are/were…）
tools/build_cloze.py          克漏字題目驗證器，以及下一批待寫清單
tools/cloze/NNN.json          克漏字題目，一批一個檔
tests/                        jsdom 測試；tests/fixtures/cloze/ 是觸發每條驗證規則的樣本
```

> 兩個 HTML 都是建置產物，但**有納入版控**，因為 GitHub Pages 直接發布它們。
> 修改遊戲請改 `tools/hangman.template.html`，再重新建置。規格見 [`SPEC.md`](SPEC.md)。

## 重新建置與測試

```bash
python3 tools/build_dict.py      # 產生兩個 HTML；第一次會自動下載約 56 MB 的 wordset
npm install                      # 測試用的 jsdom
npm test                         # 兩款遊戲、驗證器的所有測試
```

撰寫克漏字題目：

```bash
python3 tools/build_cloze.py --todo 250    # 依考試等級列出下一批待寫的語意與可用形態
python3 tools/build_cloze.py               # 驗證所有題目；有任何不合格就回傳失敗
```

驗證器會擋下：句中出現答案或其變化形（五個字母以上的字連衍生字也算，如 `quickly`）、
空格旁黏著字母（`{{blank}}s`）、答案不是該語意詞性的合法變化形、超過三句、重複或超過每字三題。
它也會提出警告（不會讓驗證失敗）：少於五個字的片段句，以及和另一題只差一兩個字的重複句型。
它檢查形式、不檢查語意，所以每一批都要把答案填回句中、對照釋義讀過一遍，
順便確認答案是這個句子需要的形態（`to` 後面要原形，`was` 後面要分詞）。

重建中文字典時（需要網路，會下載約 63 MB 的 ECDICT）：

```bash
python3 -m venv .venv
.venv/bin/pip install opencc-python-reimplemented
.venv/bin/python tools/build_zh.py
python3 tools/build_dict.py
```

## 部署

推送到 `main` 會觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：
先驗證克漏字題目並跑完所有測試，通過後才把 `hangman.html`（同時作為 `index.html`）
與 `hangman_cloze.html` 發布到 GitHub Pages。Pull request 只測試、不發布。

Workflow 會在第一次執行時自動開啟 Pages（`configure-pages` 的 `enablement: true`），
不需要手動設定。若組織政策禁止自動開啟，請改在 **Settings → Pages → Build and deployment → Source**
選擇 **GitHub Actions**。

## 資料來源與授權

| 來源 | 內容 | 授權 |
| --- | --- | --- |
| [wordset-dictionary](https://github.com/wordset/wordset-dictionary) | 英文釋義、語意與部分例句 | CC BY-SA 3.0 |
| [ECDICT](https://github.com/skywind3000/ECDICT) | 中文翻譯、考試等級、單字變化形 | MIT |
| [OpenCC](https://github.com/BYVoid/OpenCC) | 簡體轉正體（s2twp） | Apache-2.0 |

中文部分以 ECDICT 為基礎，經 OpenCC `s2twp` 轉換後再套用台灣用語修正
（計算機→電腦、導彈→飛彈、熊貓→貓熊、馬鈴薯、幼稚園、機車、太空人…），
ECDICT 未收錄的 451 個單字為人工翻譯。克漏字例句為本專案撰寫，其中約 2% 改寫自 wordset 的例句。
兩個遊戲頁面底部都列有資料來源與授權。
