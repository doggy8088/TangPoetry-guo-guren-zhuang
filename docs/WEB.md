# 過故人莊 — 互動網頁實作說明（WEB）

一頁式、直式 9:16（邏輯尺寸 1080×1920）的紙藝剪貼風動畫繪本。同一個頁面既是互動網頁，也是逐格渲染 `.mp4` 的來源（`?render=1`）。美術與技術契約見 `docs/DESIGN.md`。

## 執行

```bash
npm run serve            # node scripts/serve.mjs 5173（零依賴靜態伺服器，支援 HTTP Range，音訊可拖曳）
open http://localhost:5173/                 # 互動版
open http://localhost:5173/index.html?render=1   # 渲染模式（無 UI、1080×1920、scale 1、置於 0,0）
```

- 直接用 `file://` 開啟時，瀏覽器不允許讀取 JSON 劇本：頁面會顯示「請用小伺服器開啟喔！」並提示 `npm run serve`（不會產生 console error）。
- `?estimate` 參數可強制使用估算時間軸（開發用）。

### 截圖 / 驗證

```bash
node scripts/snap.mjs 2 15 40 70 110            # → out/snaps/t<sec>.png（1080×1920，render 模式）
node scripts/snap.mjs --range 100 120 2         # 每 2 秒一張
node scripts/snap.mjs --check 100 300           # 決定性檢查：seek 100 → 300 → 100，比對 md5
```
`snap.mjs` 會列出頁面上所有 console error / warning。

## 檔案結構

| 檔案 | 內容 |
|---|---|
| `index.html` | 載入 Google Fonts（LXGW WenKai TC、Noto Sans TC）、`vendor/gsap.min.js`（失敗時 fallback cdnjs）、`src/*.js`、`app.js` |
| `styles.css` | 舞台、字幕、生字卡、詩句條、s6/s7 HTML 版面、互動 UI。舞台上**沒有任何 CSS animation / transition** |
| `app.js` | 開機：載資料 → 建舞台與**唯一的** GSAP master timeline → 等字體 → 暴露 `window.player` |
| `src/core.js` | 命名空間 `G`、調色盤、種子 PRNG（mulberry32）、cue 內「某字何時被念到」的估算、字幕斷句 |
| `src/data.js` | 讀 `script/narration.json` + `script/timeline.json`；後者不存在（404）時以 `0.6 + 字數/4.3` 秒與相同間距規則估算，並顯示「估算時間軸」徽章 |
| `src/art.js` | 剪紙美術庫：全域 `<defs>`（紙厚度陰影濾鏡、天空/黃昏漸層、磚/瓦/木紋/格窗/黍米圖樣、菊花/菜/星星/愛心 symbol）、角色（小玉、阿庭、爸、媽、孟浩然紙偶）、小鳥、雞、樹、農舍、城鎮屋、碗盤杯、燈泡、日曆… |
| `src/icons.js` | 23 個生字剪紙圖示（對應 `vocab[].icon`）＋幾個提示圖（雞、黍碗、勾手指、睡山巨人） |
| `src/stage.js` | 舞台引擎：場景 context 輔助函式、角色控制器 `Char`、`Mover`、字幕、生字卡、詩句逐字點亮、紙張推入轉場 |
| `src/scenes-a.js` | s0 片頭、s1 邀請、s2 路上、s3 開窗 |
| `src/scenes-b.js` | s4 聊天、s5 約定、s6 圖像記憶、s7 背誦挑戰 |
| `src/ui.js` | 互動 UI（render 模式完全不建立）：播放鈕、控制列、生字表、背誦模式、鍵盤、音訊同步 |
| `scripts/serve.mjs` | 靜態伺服器 |
| `scripts/snap.mjs` | Playwright 截圖 / 決定性檢查 |
| `assets/paper-grain.svg`, `assets/favicon.svg` | 紙張纖維紋理（靜態疊層）、網站圖示 |

一律使用 classic script（非 ES module），所以 `file://` 下仍能執行並顯示友善訊息。

## 架構

### 一條時間軸
`G.buildStage(data)` 建立 `gsap.timeline({ paused: true })`，所有東西都放在這一條上：

1. **場景 DOM**：每個場景一個 `<section class="scene">`，內含一張 1080×1920 的 inline `<svg>`（背景、角色、道具）與一層 `.scene-html`（s6/s7 的詩句、挑戰卡用 HTML 排版）。DOM 只建一次，用 `autoAlpha`（opacity + visibility）切換。
2. **場景動畫**：`G.scenes[id].anim(ctx)` 以 cue 的 `start/end` 為錨點排程（`ctx.s(id)`, `ctx.e(id)`, `ctx.at(id, 0.6)`；`ctx.w(id, '詞')` 用字數加權（標點視為停頓）估算該詞被念到的時刻，用來同步卡片、高亮、手勢）。
3. **角色說話**：每個 小玉/阿庭 的 cue，對應場景註冊的角色實例在 `[start, end]` 間每 0.12 s 用 `tl.set(mouth, {attr:{'data-m':…}})` 切換嘴型（open / mid / smile / closed，種子亂數）。CSS 以屬性選擇器顯示對應嘴型。呼吸（`scaleY` yoyo）、眨眼（每 3–4 s）也都排在 timeline 上。
4. **字幕**（`G.buildSubtitles`）：說話者標籤（小玉＝磚紅、阿庭＝湖藍、旁白＝墨綠）＋文字；每行 ≤16 字、每段 ≤2 行（在標點處斷、避頭尾），依加權字數比例在 cue 內換段。字幕區固定在 y≈1490–1776。
5. **生字卡**（`G.buildCards`）：米白圓角卡 840×540：左楷體大字＋直排注音（聲調在右），右剪紙圖示，下方「＝ 意思」（長意思自動兩行、縮字）。依詞在旁白中出現的時刻 `back.out` 彈入，多張卡疊放（舊卡上移露出頂部標籤），cue 結束前 0.3 s 一起滑出。場景可用 `ctx.card(cueId, {top, dy, times})` 調整位置避免擋住重點；卡片永遠不會進入字幕區。
6. **詩句條**（`G.buildRecite`）：`recite` cue 在畫面上方顯示該聯（兩行、每行 5 字、楷體 112px、寬字距），從「跟著念」之後依實際念到的時刻逐字由墨灰轉墨黑、微放大、背後點亮黍黃圓點；已念過的半句會預先亮著（如 s4-6 的「開軒面場圃」），整聯完成時輕跳一下。s6/s7 的逐字點亮在場景內自行處理。
7. **轉場（紙張推入）**：場景開始前 0.35 s，新的一頁從右側滑入（`x: 1080 → 0`，0.7 s `power2.inOut`，左緣帶柔和紙張陰影），舊的一頁不縮放、只往左平移 260px 並微微變暗；字幕層同時輕輕降一下透明度（0.15 s）。轉場只用平移與透明度，不會壓扁或變形畫面內容。

### 決定性（逐格渲染的關鍵）
- 只用 GSAP timeline；沒有 CSS 動畫/轉場、沒有 rAF 自跑狀態、所有「隨機」來自種子 PRNG。
- 初始狀態在建構時以 `gsap.set` 設好；時間軸上一律用 `fromTo(..., {immediateRender:false})` 或 `tl.set`，同一屬性的 tween 前後銜接、不重疊，因此 `tl.time(t)` 往前往後跳都一致（GSAP 倒帶時會回到 tween 開始前的值）。
- 沒有會改 DOM 的 `onComplete`。`gsap.defaults({lazy:false})`、`force3D:false`。
- SVG 可動部件都以「外層 translate 定位、內層繞 (0,0) 轉動」的方式建構，`svgOrigin: "0 0"` 在任何變形之前設定（避免 smoothOrigin 偏移）。
- 建好時間軸後先 `tl.time(total)` 再 `tl.time(0)` 暖機一次：所有 tween 依時間順序初始化，之後任何 seek 順序得到的 DOM 完全相同。
- 字體：開機時以 `document.fonts.load()` 預載舞台上**每一個**實際出現的字（含 SVG `<text>`），避免 Google Fonts 的 unicode-range 子集在渲染途中才載入；舞台關閉 `text-spacing-trim` 與 kerning，標點間距不受字體載入順序影響。
- 截圖端建議加 Chromium 參數 `--disable-partial-raster`（`snap.mjs` 已使用）：否則跳著 seek 時，局部重繪會讓大面積漸層的抖色有 ±20 級的極細微差異（肉眼看不出，但 md5 不同）。依序逐格渲染時本來就一致。
- 驗證：`node scripts/snap.mjs --check 100 300` → 兩次 t=100 截圖 md5 相同；另以 11 個時間點、兩種完全不同的 seek 順序交叉比對，全部 md5 相同。

### 渲染模式契約
`index.html?render=1`：無 UI、不建立任何 Audio、舞台 1080×1920 於 (0,0) scale 1、`html,body{margin:0;overflow:hidden;background:#FBF3E4}`。
```js
window.player = {
  ready,      // Promise：JSON、timeline 建好、字體（document.fonts.load 兩種字體＋頁面上所有用到的字）、紙紋圖片
  duration,   // = timeline.total
  seek(t)     // 同步：tl.pause(); tl.time(t, false)
}
```

### 互動模式
- 單一 `<audio>`（`audio/narration.m4a`，不支援時 `.mp3`）是時鐘：播放時每幀 `tl.time(audio.currentTime)`；音檔不存在、載入失敗或使用估算時間軸時，改用 GSAP 自己的時鐘（靜音播放）。旁白播完（尾巴 4 s）也自動交給 GSAP 時鐘。BGM `audio/bgm.m4a` 循環、音量 0.22。
- 舞台依視窗等比縮放（safe-area aware），控制列永遠不覆蓋舞台：直式手機時控制列貼齊螢幕底部（含 safe-area），舞台縮放到控制列**上方**的區域並置中（`scale = min(vw/1080, (vh − 控制列高)/1920)`）；桌機/橫式時控制列放在舞台正下方。不再自動隱藏；點舞台可播放/暫停。
- 控制：播放/暫停、進度條（場景刻度、可拖曳、方向鍵 ±5 s）、8 個場景快選、靜音；鍵盤：空白鍵播放/暫停、←/→ 切場景、M 靜音、Esc 關面板。
- 「生字表」：23 張小卡；點擊彈出一張完整的生字卡（字＋直排注音、圖示、＝意思、例句、底部「再聽一次／關閉」按鈕，最高 80vh、超出時卡內捲動）並播放 `timeline.vocab_audio[詞]`。
- 「背誦模式」：四張記憶圖（固定寬度，切換隱藏程度時版面不跳動）＋四聯詩（46px 字格，390px 寬手機一行 5 格放得下；窄螢幕時圖在上、詩在下）；隱藏程度 0 全部顯示／1 隱藏生字（挑戰題的關鍵詞）／2 隱藏一半／3 只剩圖；點空格翻開；「朗讀這一句」播放 s6-2…s6-5 的 cue 音檔（沒有個別音檔時播放合併旁白的對應片段）。

## 場景一覽
| 場景 | 畫面 |
|---|---|
| s0 片頭 | 天空、遠山、稻田條紋；書卷由中間向兩側展開，「過故人莊」逐字落下、蓋上「孟」字印；小鳥飛過；孟浩然戴斗笠的紙偶（下有木棍）升起揮手、鞠躬後沉下；書卷縮成頁首，三張字卡出現時書卷上對應的字變紅點亮；小玉、阿庭從兩側跳進來揮手 |
| s1 邀請 | 農家院子（土黃磚屋、菜園、竹籬、啄米的雞）＋相框「故人＝老朋友」；鏡頭推近小玉、頭上冒出燈泡；廚房（灶火、鍋蓋掀起冒煙、雞肉與黍飯上桌、放大鏡看見一粒粒黃米、打勾）；小玉舉信、小鳥叼走；視差飛越稻田、小河、城鎮到阿庭家窗前；阿庭房間讀信（「邀請」「田家」螢光筆高亮）、背包飛上身；地圖小路與定位針，三張字卡與第一聯 |
| s2 路上 | 阿庭走路循環＋三層視差，村子越來越近；俯瞰村莊，十棵笑臉樹一棵棵冒出、伸出手臂牽成一圈、愛心；鏡頭拉遠：郭（環形土牆）發光、斜斜的青山與紅色虛線、山變成閉眼微笑的睡巨人打 Zzz；阿庭說話時左下角出現頭像小圓窗 |
| s3 開窗 | 小玉家門口（燈籠、春聯、「小玉家」匾）兩人擊掌「啪！」、香味波浪；屋內木牆格窗「嘎吱」推開、光線灑入；鏡頭推進窗景：左曬穀場（雞、竹耙）右菜園，「場」「圃」標籤與框線依手指高亮 |
| s4 聊天 | 晚餐（圓窗夕景、燈籠、爸媽紙偶、菜餚），舉杯、桂花香飄起；問號；小玉的想像泡泡：桑樹→桑葉→蠶寶寶→蠶絲→絲綢，再換成麻→莖纖維→繩子→布，衣服閃光 |
| s5 約定 | 天空由藍轉黃昏、太陽下沉、影子拉長；阿庭回頭；日曆快速翻到「九月 初九 重陽」；滿地菊花由左到右綻放；勾手指特寫圓框＋星星 |
| s6 圖像記憶 | 四個木框相片依序落下，圖示依旁白彈入，右側詩句逐字點亮，最後四框一起發光 |
| s7 背誦挑戰 | 全詩（每聯配圖）逐句點亮；「挑戰時間！」、兩人拿旗子從兩側探頭；四張填空卡（空格放提示圖、思考點點、翻牌揭曉、上方四朵菊花進度）；全詩變紅＋彩紙；「我會背 過故人莊」菊花獎章；菊花田揮手道別；最後淡出成標題卡 |

## 已知限制
- `file://` 無法讀 JSON（瀏覽器限制），需 `npm run serve`。
- 「念到某詞的時刻」是依字數加權估計（TTS 實際語速會有小誤差，約 ±0.3 s）。若之後 timeline 提供字級時間，可在 `G.tAt` 一處替換。
- 調色盤之外另用了少數必要色（膚色 `#F9DCC4`、腮紅 `#F4A6A0`、嘴內 `#7A3326`、阿庭深藍褲 `#24507A`、孟浩然淺灰長衫 `#E3DDD2`、院子土色 `#EAD3A2`、純白高光），定義在 `G.P`。
- 字體來自 Google Fonts；離線時退回系統楷體/黑體（`ready` 最多等 20 s）。
- 每幀截圖約 0.2 s（主要是 PNG 編碼），整片約 14,600 格。
