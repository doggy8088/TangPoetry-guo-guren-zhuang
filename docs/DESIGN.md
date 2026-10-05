# 《過故人莊》兒童動畫 — 美術與技術規格（由 Fable 5.1 規劃）

目標觀眾：小學三年級（8 歲）。目標：透過小玉邀請阿庭作客的故事，沉浸式理解每個生字，並用「四張圖」圖像記憶法背熟全詩。

## 產出
1. `index.html`（+ `app.js`, `styles.css`, `assets/`）— 互動網頁，直式 9:16 舞台（邏輯尺寸 1080×1920），可在手機/桌機瀏覽。
2. `out/guo-guren-zhuang.mp4` — 1080×1920、30fps、H.264 + AAC，由同一份網頁逐格渲染（確保網頁與影片一致）。

## 美術方向：「紙藝剪貼 × 淡水彩」
- 整體像一本手工剪紙繪本：每個物件是有圓角、略帶紙張質感的色塊，層層疊放，帶柔和的投影（`filter: drop-shadow(0 6px 0 rgba(0,0,0,.08))` 類似的「紙厚度」感），不要用寫實漸層或 3D 光澤。
- 線條極少；以色塊形狀說話。角色眼睛是黑色圓點＋白色高光，腮紅是淡粉色橢圓。
- 背景使用大色塊：天空、遠山、田野、稻田條紋。白天天空 `#CFE8F3 → #EAF6FB`，黃昏 `#F7B267 → #F4845F → #6B4F8A`。
- 調色盤（嚴格使用，避免雜色）：
  - 紙底米白 `#FBF3E4`、紙底深 `#F2E6CF`
  - 墨黑 `#2B2B2B`（文字主色）、墨灰 `#6B6257`
  - 墨綠 `#2F6B4F`、嫩綠 `#8CC084`、淺綠 `#C9E4B4`
  - 青山 `#6FA8B8`、青山深 `#4F8699`
  - 土黃 `#D9A441`、稻金 `#F2C14E`、黍黃 `#F6D55C`
  - 磚紅 `#C8553D`（小玉主色）、湖藍 `#2E6FA7`（阿庭主色）
  - 菊黃 `#F2B33D`、菊橘 `#E98A2B`
  - 木色 `#A9743F`、木色深 `#7A4E24`
- 字體：
  - 詩句、生字卡大字：`'LXGW WenKai TC'`（Google Fonts），fallback `'BiauKai','DFKai-SB','STKaiti',serif`。
  - 旁白字幕、UI：`'Noto Sans TC'`，fallback `'PingFang TC','Microsoft JhengHei',sans-serif`。
  - 注音以小字排在生字右側或上方（可用 `writing-mode: vertical-rl` 直排注音，或簡單橫排皆可，但要清楚）。
- 文字尺寸（以 1080 寬為準）：字幕 ≥ 52px、詩句大字 96–128px、生字卡主字 200px+。文字必須有高對比底（米白圓角卡片）。字幕區固定在舞台下方 ~ 1480–1760px，一行最多 16 字，自動換行最多兩行。
- 動態原則：所有動畫**只能**用 GSAP timeline 驅動（不可用 CSS animation/transition、不可用 requestAnimationFrame 自跑狀態、不可用 Math.random 未播種的隨機）。這樣 `seek(t)` 才能逐格渲染出一致畫面。需要「隨機」時用固定種子的 PRNG。
- 緩動：進場用 `back.out(1.4)` 或 `elastic.out(1, .6)`（輕微），移動用 `power2.inOut`。物件進場帶一點「紙片彈跳」。角色說話時嘴巴用 2–3 個 mouth state 交替（由 timeline 控制，用 cue 的 start/end 區間，每 0.12s 切換）。角色待機時有緩慢上下呼吸（yoyo）、每 3–4 秒眨眼一次（都在 timeline 上排好）。

## 角色設計（inline SVG symbol，部件分組方便動畫）
- **小玉**：圓臉、兩個包包頭綁紅緞帶、磚紅色唐裝（黃色滾邊）、米白褲、紅布鞋。開朗。部件：`head, hairL, hairR, eyes(L,R), mouth(closed/open/smile), body, armL, armR, legL, legR`。
- **阿庭**：圓臉、短髮有一撮翹毛、湖藍色唐裝（米白滾邊）、深藍褲、小背包（黃色）。好奇。相同部件結構。
- **小玉爸媽**：高一點的紙偶，墨綠與土黃衣，只在餐桌場景出現。
- **孟浩然**：片頭短暫出現，戴斗笠、淺灰長衫，長鬚（簡單色塊）。
- **小鳥**：黃色圓身、橘色嘴，翅膀兩個狀態。
- 角色高度約舞台的 1/5（≈380px）作為中景；特寫時放大。

## 場景分鏡
見 `script/narration.json` 每個 cue 的 `visual` 欄位；`vocab` 欄位表示該 cue 要彈出的生字卡，`recite` 表示該 cue 要顯示並逐字點亮的詩句行號（0–3）。
生字卡設計：米白圓角卡（約 820×520），左側大字（楷體）＋注音，右側簡單剪紙圖示，下方「＝ 意思」。卡片以 `back.out` 從下方彈入，停留至 cue 結束前 0.3s 滑出。多張卡依序出現（可重疊堆疊微微偏移）。

「跟著念」詩句顯示：楷體大字一行 5 字，字與字間距大；每字按順序由墨灰變墨黑並微放大（0.35s 一字），對齊 cue 內「跟著念：」之後的大約時間（可用 cue 時長的後 40% 平均分配）。

## 字幕
每個 cue 顯示字幕：說話者標籤（小玉＝磚紅、阿庭＝湖藍、旁白＝墨綠）＋文字。字幕卡為米白圓角，墨黑字，最大兩行；超過時自動分成多段，依文字長度比例在 cue 時間內切換。

## 技術契約
### `script/timeline.json`（由 TTS 產線產生）
```json
{ "fps": 30, "total": 480.0,
  "scenes": [{ "id":"s1", "name":"邀請", "start": 23.1, "end": 95.3 }],
  "cues": [{ "id":"s1-1", "scene":"s1", "speaker":"旁白", "text":"…", "start": 23.1, "end": 31.9, "audio":"audio/cues/s1-1.wav" }],
  "vocab_audio": { "具": "audio/vocab/具.wav" } }
```
- 網頁啟動時 fetch `script/narration.json` 與 `script/timeline.json`，依 cue 的 start/end 排 GSAP master timeline。
- 單一合併音軌 `audio/narration.m4a`（與 `.mp3` 備援）與 `audio/bgm.m4a`（可選、低音量）。網頁播放時以 `audio.currentTime` 為時間主軸，每幀 `tl.time(audio.currentTime)`。

### 渲染模式
- `index.html?render=1`：隱藏所有控制列、不建立 Audio、舞台固定 1080×1920 scale(1) 置於 (0,0)、背景純色。
- 必須暴露：`window.player = { ready: Promise<void>, duration: number, seek(t: number): void }`。`ready` 在字體（`document.fonts.ready`）、JSON、SVG 資源載入且 timeline 建好後 resolve。`seek(t)` 同步地將 master timeline 設到 t 並暫停（`tl.pause(t)` / `tl.time(t)`）。
- 渲染器（Playwright chromium，viewport 1080×1920，deviceScaleFactor 1）對每一格呼叫 `seek(f/30)` 後截圖，串給 ffmpeg（image2pipe → libx264 crf 18, yuv420p, preset slow, `-movflags +faststart`），混入旁白＋BGM 音軌。

## 互動網頁功能
1. 置中直式舞台，依視窗等比縮放（手機全螢幕、桌機留灰邊）。
2. 開場大播放鈕（處理 autoplay 限制），播放/暫停、進度條（場景刻度）、場景快選列（片頭/邀請/路上/開窗/聊天/約定/圖像記憶/背誦挑戰）、靜音鈕。
3. 「生字表」面板：23 個生字卡，點擊 → 放大顯示（字、注音、意思、例句、圖示）並播放該字語音。
4. 「背誦模式」面板：四張圖＋四行詩；滑桿/按鈕設定隱藏程度（0 全顯示、1 隱藏生字、2 隱藏一半、3 只剩圖），點空格可翻開；有「朗讀這一句」按鈕（播放 s6-2..s6-5 對應 cue 音檔片段）。
5. 鍵盤：空白鍵播放/暫停，←/→ 切場景。
6. 全部純靜態（可直接以 `file://` 或任何靜態伺服器開啟），外部資源只有 Google Fonts 與 GSAP（cdnjs）；需在離線時 fallback 不致壞掉（GSAP 另存一份於 `vendor/gsap.min.js` 優先載入本機版）。
