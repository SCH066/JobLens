# JobLens

AI 求職自動化工具 — 自動聚合職缺、AI 匹配評分、Obsidian Kanban 看板管理。

## 解決什麼問題

每天手刷 104 / CakeResume / Yourator 找工作太浪費時間。這個工具把「找職缺 → 判斷要不要投」的流程自動化：

1. **自動聚合** — 各平台的職缺通知 email，由 Google Apps Script 自動解析、匯入 Google Sheet
2. **AI 篩選** — Claude API 根據你的履歷和定位策略，對每筆職缺做匹配度評分
3. **看板管理** — 只有高度匹配的職缺進入 Obsidian Kanban 看板，附帶完整分析

## 架構

```
104 職缺通知 Email
        ↓
Google Apps Script（每日自動）
  → 解析 email，提取職缺連結
  → 寫入 Google Sheet（去重）
        ↓
npm run scan
  → 讀取 Google Sheet
  → 104 職缺詳情 API 補完資訊
  → Claude AI 匹配評分
  → 寫入 Obsidian Kanban + 職缺詳情 .md
```

```
Obsidian Kanban 看板
┌──────────┬──────────┬──────────┐
│  待審核   │ 審核通過  │  已產出   │
│          │          │          │
│ Score:82 │  （你拖） │ PDF+CL   │
│ Score:75 │          │          │
└──────────┴──────────┴──────────┘
```

## 技術棧

| 項目 | 選擇 | 原因 |
|------|------|------|
| 語言 | TypeScript | 型別安全、生態豐富 |
| LLM | Claude API (Haiku) | 評分不需要最強模型，省成本 |
| 資料來源 | Google Apps Script + Sheet | 免部署、免 OAuth、平台自動推送 |
| 職缺詳情 | 104 非官方 API | 搜尋 API 已封鎖，詳情 API 仍可用 |
| 看板 | Obsidian Kanban Plugin | .md 格式，CLI 讀寫無障礙 |
| PDF 產出 | Typst CLI | 中文排版最佳（Phase 2） |

## 快速開始

### 前置需求

- Node.js 18+
- Obsidian + Kanban Plugin
- Claude API Key（[console.anthropic.com](https://console.anthropic.com)）
- Google 帳號（用於 Apps Script + Sheet）

### 安裝

```bash
git clone https://github.com/SCH066/JobLens.git
cd JobLens
npm install
```

### 設定

1. 複製 `.env.example` 為 `.env`，填入你的設定：

```bash
cp .env.example .env
```

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key
VAULT_PATH=/path/to/your/obsidian/vault
SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/your-sheet-id/export?format=csv&gid=your-gid
```

2. 建立個人資料（不會被 commit）：

```bash
# 把你的履歷和定位策略放到 data/
cp /path/to/your/resume.md data/resume-base.md
cp /path/to/your/positioning.md data/positioning.md
```

3. 設定 Google Apps Script（詳見下方）

### 使用

```bash
# 掃描職缺 → AI 評分 → 寫入看板
npm run scan

# 不需要 API Key 的模式（跳過評分）
npm run scan -- --no-score
```

### Google Apps Script 設定

1. 建一個 Google Sheet
2. 延伸功能 → Apps Script（或從 [script.google.com](https://script.google.com) 新建）
3. 貼上 `apps-script/Code.gs` 的內容
4. 把 `SpreadsheetApp.getActiveSpreadsheet()` 改為 `SpreadsheetApp.openById("你的Sheet ID")`
5. 執行 `parseEmails()` 測試
6. 設定每日定時觸發

### Obsidian 設定

1. 確認安裝 Kanban Plugin
2. 在 Vault 中建立 `JobLens/` 資料夾
3. 執行 `npm run scan`，看板會自動建立

## 專案結構

```
JobLens/
├── src/
│   ├── scrapers/rss-104.ts    # 讀 Google Sheet + 104 詳情 API
│   ├── filter/index.ts        # 黑名單過濾、去重
│   ├── matcher/
│   │   ├── prompt.ts          # Claude 評分 prompt
│   │   └── scorer.ts          # 呼叫 Claude API
│   ├── kanban/
│   │   ├── parser.ts          # 解析 kanban.md
│   │   └── writer.ts          # 寫入看板
│   ├── output/job-detail.ts   # 產出職缺詳情 .md
│   ├── commands/scan.ts       # scan 指令
│   ├── config.ts              # 設定
│   ├── types.ts               # 型別定義
│   └── index.ts               # 主程式入口
├── apps-script/Code.gs        # Google Apps Script（104 email 解析）
├── data/                      # 個人資料（不 commit）
├── templates/                 # Typst 模板（Phase 2）
└── .env.example               # 環境變數範例
```

## Roadmap

- [x] Phase 1：自動聚合 + AI 評分 + Kanban 看板
- [ ] Phase 2：客製化 Cover Letter + Typst PDF 產出
- [ ] Phase 3：多平台支援（CakeResume、Yourator、LinkedIn）
- [ ] Phase 3：n8n workflow 視覺化版本

## 隱私

- API Key、個人履歷、職缺資料都不會被 commit
- Google Sheet CSV URL 透過 `.env` 管理
- Apps Script 只讀取 Gmail，不修改或刪除任何 email

## License

MIT
