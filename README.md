# Hangman 單字遊戲

看英英釋義或中文解釋猜單字的 Hangman 遊戲。整個遊戲就是**一個 HTML 檔案**，字典已經內建，
開啟後完全不需要網路。

👉 **[線上試玩](https://gjchentw.github.io/hangman/)**

---

## 遊戲內容

- 自訂字庫：貼上任何英文單字清單，遊戲就用這些字出題
- 內建 **68,352** 個單字、**119,854** 條英文釋義，以及 **100% 覆蓋**的正體中文解釋
- 中英文解釋可隨時切換
- 發音使用瀏覽器內建語音合成（Web Speech API），可挑選語音、調整音調與語速
- 完全離線：沒有任何對外連線，直接用 `file://` 開啟就能玩

## 開始遊戲

1. 下載 [`hangman.html`](hangman.html)，用瀏覽器開啟（直接雙擊即可，不需要架站）
2. 在文字框貼上想練習的單字，用**半形逗號、空白或換行**分隔：

   ```
   ability,serendipity cat
   hangman
   ```

3. 按「開始遊戲」。查不到釋義的單字會列出來並自動排除，不會出現在測驗中
4. 按「開始猜字」進入遊戲

字庫會記在瀏覽器裡，下次開啟可直接「沿用上次字庫」。

## 操作方式

| 操作 | 說明 |
| --- | --- |
| 實體鍵盤 A–Z | 猜字母 |
| 螢幕鍵盤（QWERTY） | 點擊猜字母，同時顯示已猜過的字母 |
| 🔊 發音 | 唸出目前的單字 |
| 中文 / EN | 切換解釋語言，遊戲中隨時可切 |
| 簡易 / 嚴格 | 切換猜字模式，遊戲中隨時可切 |
| 音調 / 語速 | 調整發音，放開滑桿會立刻試聽 |
| 空白鍵 | 進行中：唸出目前單字；該題結束後：進入下一題 |
| Enter | 該題結束後進入下一題 |

## 遊戲規則

- 畫面顯示單字的解釋，答案以底線表示：`_______`
- **答錯 6 次**就輸了，吊人圖會依序畫出頭、身體、雙手、雙腳
- 猜完所有字母就贏
- 連字號等非字母符號一開始就會顯示，不需要猜
- 每題結束後會停住並公布答案，按「下一題」才會繼續

### 兩種模式

**簡易模式**（預設）— 輸入字母，揭露該字母在單字中的**所有**位置：

```
word : ability
輸入 : i
結果 : __i_i__
```

猜過的字母會變色並停用；猜到不存在的字母才算錯。

**嚴格模式** — 必須依照**正確拼字順序**輸入，一次只揭露一個位置：

```
word : ability
輸入 : a → a______
輸入 : b → ab_____
輸入 : i → abi____
```

閃爍的游標標示下一個該輸入的位置。輸入的字母若不是下一個字母就算錯，**即使它存在於單字中**。
嚴格模式的字母不會被用掉，可以重複輸入（例如 `ability` 需要按兩次 `i`）。

語言與模式的選擇都會記在瀏覽器裡。

## 瀏覽器需求

字典以 gzip 內嵌，解壓縮需要 `DecompressionStream`：

- Chrome / Edge 80+
- Safari 16.4+
- Firefox 113+

發音需要瀏覽器提供英文語音；找不到時發音按鈕會停用，其餘功能不受影響。

## 專案結構

```
hangman.html                  最終成品（約 4.8 MB，含內嵌字典）
tools/hangman.template.html   遊戲原始碼，含 __DICT_PAYLOAD__ / __ZH_PAYLOAD__ 佔位符
tools/build_dict.py           產生 hangman.html（下載 wordset → 裁剪 → gzip → base64 → 注入）
tools/build_zh.py             產生 tools/zh_dict.json（ECDICT → OpenCC → 修正 → 合併人工翻譯）
tools/zh_fixes.py             OpenCC 之後的台灣用語修正規則
tools/zh_manual.json          ECDICT 未收錄的 451 個單字，人工翻譯
tools/zh_dict.json            合併後的中文字典（建置產物，已納管以便免下載重建）
```

> `hangman.html` 是建置產物，但**有納入版控**，因為 GitHub Pages 直接發布它。
> 修改遊戲請改 `tools/hangman.template.html`，再重新建置。

## 重新建置

只改遊戲程式碼時：

```bash
python3 tools/build_dict.py      # 會用到 tools/.wordset-cache，第一次自動下載約 56 MB
```

要重建中文字典時（需要網路，會下載約 63 MB 的 ECDICT）：

```bash
python3 -m venv .venv
.venv/bin/pip install opencc-python-reimplemented
.venv/bin/python tools/build_zh.py
python3 tools/build_dict.py
```

## 部署

推送到 `main` 會觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，
把 `hangman.html` 當成 `index.html` 發布到 GitHub Pages。

Workflow 會在第一次執行時自動開啟 Pages（`configure-pages` 的 `enablement: true`），
不需要手動設定。若組織政策禁止自動開啟，請改在 **Settings → Pages → Build and deployment → Source**
選擇 **GitHub Actions**。

## 資料來源與授權

| 來源 | 內容 | 授權 |
| --- | --- | --- |
| [wordset-dictionary](https://github.com/wordset/wordset-dictionary) | 英文釋義 | CC BY-SA 3.0 |
| [ECDICT](https://github.com/skywind3000/ECDICT) | 中文翻譯 | MIT |
| [OpenCC](https://github.com/BYVoid/OpenCC) | 簡體轉正體（s2twp） | Apache-2.0 |

中文部分以 ECDICT 為基礎，經 OpenCC `s2twp` 轉換後再套用台灣用語修正
（計算機→電腦、導彈→飛彈、熊貓→貓熊、馬鈴薯、幼稚園、機車、太空人…），
ECDICT 未收錄的 451 個單字為人工翻譯。
