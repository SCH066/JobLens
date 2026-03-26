/**
 * JobLens — 104 Email Parser
 * 從 Gmail 讀取 104 職缺通知信，解析後寫入 Google Sheet
 *
 * 設定方式：
 * 1. 在 Google Sheet 中開啟 延伸功能 → Apps Script
 * 2. 貼上此程式碼
 * 3. 執行 parseEmails() 測試
 * 4. 設定觸發條件：每日自動執行
 */

// ===== 設定 =====
const SHEET_NAME = "jobs";  // Sheet 分頁名稱
const SENDER_FILTER = "104.com.tw";  // 寄件者過濾
const SUBJECT_KEYWORDS = ["職務", "工作", "職缺"];  // 主旨關鍵字（命中任一個就處理）
const DAYS_TO_SEARCH = 3;  // 搜尋最近幾天的 email
const MAX_EMAILS = 50;  // 單次最多處理幾封

function parseEmails() {
  const sheet = getOrCreateSheet();
  const existingUrls = getExistingUrls(sheet);

  // 搜尋 Gmail
  const after = new Date();
  after.setDate(after.getDate() - DAYS_TO_SEARCH);
  const afterStr = Utilities.formatDate(after, "Asia/Taipei", "yyyy/MM/dd");

  const query = `from:${SENDER_FILTER} after:${afterStr}`;
  const threads = GmailApp.search(query, 0, MAX_EMAILS);

  Logger.log(`找到 ${threads.length} 封 104 相關 email`);

  let newCount = 0;

  for (const thread of threads) {
    const subject = thread.getFirstMessageSubject();

    // 主旨過濾
    const matchSubject = SUBJECT_KEYWORDS.some(kw => subject.includes(kw));
    if (!matchSubject) {
      Logger.log(`跳過（主旨不符）: ${subject}`);
      continue;
    }

    const messages = thread.getMessages();
    for (const message of messages) {
      const html = message.getBody();
      const jobs = extractJobsFromHtml(html);

      for (const job of jobs) {
        // 去重：檢查 URL 是否已存在
        if (existingUrls.has(job.url)) continue;

        // 寫入 Sheet
        sheet.appendRow([
          new Date().toISOString(),  // 匯入時間
          job.title,                  // 職稱
          job.company,                // 公司
          job.location,               // 地點
          job.experience,             // 經歷
          job.education,              // 學歷
          job.salary,                 // 薪資
          job.url,                    // 104 連結
          extractJobId(job.url),      // Job ID
          "待處理",                    // 狀態
        ]);

        existingUrls.add(job.url);
        newCount++;
      }
    }
  }

  Logger.log(`新增 ${newCount} 筆職缺到 Sheet`);
}

/**
 * 從 104 email HTML 中提取職缺資訊
 * 104 email 格式：每筆職缺是一個帶連結的職稱，下方有地點|經歷|學歷和薪資
 */
function extractJobsFromHtml(html) {
  const jobs = [];

  // 找所有 104 職缺連結
  // 格式：<a href="https://www.104.com.tw/job/xxxxx?...">職稱</a>
  const linkRegex = /<a[^>]*href="(https?:\/\/www\.104\.com\.tw\/job\/[a-zA-Z0-9]+[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const title = match[2].trim();

    // 清理 URL（移除追蹤參數，保留 job ID）
    const url = cleanJobUrl(rawUrl);

    // 跳過非職缺連結（「看更多」、「應徵」等）
    if (title === "看更多" || title === "應徵" || title === "儲存" || title.length < 3) continue;

    // 在連結附近找公司名、地點、經歷、學歷、薪資
    const context = getContextAroundMatch(html, match.index, 800);

    jobs.push({
      title: title,
      company: extractCompany(context, match.index, html),
      location: extractField(context, "地區|區"),
      experience: extractField(context, "年以上|年|經歷不拘|經歷"),
      education: extractField(context, "大學|碩士|專科|高中|博士|學歷"),
      salary: extractSalary(context),
      url: url,
    });
  }

  // 去重（同一封信可能重複出現同一個連結）
  const seen = new Set();
  return jobs.filter(j => {
    if (seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });
}

/**
 * 清理 104 職缺 URL
 */
function cleanJobUrl(rawUrl) {
  const match = rawUrl.match(/104\.com\.tw\/job\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://www.104.com.tw/job/${match[1]}`;
  }
  return rawUrl;
}

/**
 * 從 URL 提取 Job ID
 */
function extractJobId(url) {
  const match = url.match(/\/job\/([a-zA-Z0-9]+)/);
  return match ? match[1] : "";
}

/**
 * 取得匹配位置前後的文字（移除 HTML tags）
 */
function getContextAroundMatch(html, index, range) {
  const start = Math.max(0, index - range);
  const end = Math.min(html.length, index + range);
  const slice = html.substring(start, end);
  // 移除 HTML tags，保留文字
  return slice.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

/**
 * 提取公司名稱
 * 104 email 中公司名通常在職缺連結的上方區塊
 */
function extractCompany(context, matchIndex, fullHtml) {
  // 往前找最近的粗體或顯眼文字（公司名通常是 <b> 或 <strong> 或較大字體）
  const before = fullHtml.substring(Math.max(0, matchIndex - 500), matchIndex);

  // 嘗試找 <b>公司名</b> 或 <strong>公司名</strong>
  const boldMatch = before.match(/<(?:b|strong)[^>]*>([^<]{2,50})<\/(?:b|strong)>/gi);
  if (boldMatch && boldMatch.length > 0) {
    const last = boldMatch[boldMatch.length - 1];
    const nameMatch = last.match(/>([^<]+)</);
    if (nameMatch) return nameMatch[1].trim();
  }

  return "";  // 找不到就留空，之後由詳情 API 補
}

/**
 * 從上下文中提取特定欄位
 */
function extractField(context, pattern) {
  // 104 email 格式：地點 ｜ 經歷 ｜ 學歷
  // 嘗試找包含特定關鍵字的片段
  const regex = new RegExp(`([\\u4e00-\\u9fff\\w]+(?:${pattern})[\\u4e00-\\u9fff\\w]*)`, "i");
  const match = context.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * 提取薪資
 */
function extractSalary(context) {
  // 月薪 XX,XXX ~ XX,XXX 元
  const salaryMatch = context.match(/月薪\s*[\d,]+\s*[~～]\s*[\d,]+\s*元/);
  if (salaryMatch) return salaryMatch[0];

  // 年薪
  const annualMatch = context.match(/年薪\s*[\d,]+\s*[~～]\s*[\d,]+\s*萬/);
  if (annualMatch) return annualMatch[0];

  // 待遇面議
  if (context.includes("待遇面議")) return "待遇面議";

  return "";
}

/**
 * 取得或建立 Sheet
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 寫入表頭
    sheet.appendRow([
      "匯入時間", "職稱", "公司", "地點", "經歷", "學歷", "薪資", "連結", "Job ID", "狀態"
    ]);
    // 凍結第一行
    sheet.setFrozenRows(1);
    // 設定欄寬
    sheet.setColumnWidth(1, 150);  // 匯入時間
    sheet.setColumnWidth(2, 250);  // 職稱
    sheet.setColumnWidth(3, 200);  // 公司
    sheet.setColumnWidth(8, 300);  // 連結
  }

  return sheet;
}

/**
 * 取得已存在的 URL（去重用）
 */
function getExistingUrls(sheet) {
  const urls = new Set();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {  // 跳過表頭
    const url = data[i][7];  // 第 8 欄是連結
    if (url) urls.add(url);
  }

  return urls;
}

/**
 * 手動新增職缺 URL
 * 在 Sheet 的 "manual" 分頁中貼 URL，執行此函式匯入
 */
function importManualUrls() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const manualSheet = ss.getSheetByName("manual");
  if (!manualSheet) {
    Logger.log("請建立 'manual' 分頁，在 A 欄貼入 104 職缺 URL");
    return;
  }

  const jobsSheet = getOrCreateSheet();
  const existingUrls = getExistingUrls(jobsSheet);

  const data = manualSheet.getDataRange().getValues();
  let newCount = 0;

  for (const row of data) {
    const rawUrl = String(row[0]).trim();
    const jobId = extractJobId(rawUrl);
    if (!jobId) continue;

    const url = `https://www.104.com.tw/job/${jobId}`;
    if (existingUrls.has(url)) continue;

    jobsSheet.appendRow([
      new Date().toISOString(),
      "",  // 職稱（待詳情 API 補）
      "",  // 公司
      "",  // 地點
      "",  // 經歷
      "",  // 學歷
      "",  // 薪資
      url,
      jobId,
      "待處理",
    ]);

    existingUrls.add(url);
    newCount++;
  }

  Logger.log(`手動匯入 ${newCount} 筆職缺`);
}

// ===== 選單 =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("JobLens")
    .addItem("解析 104 Email", "parseEmails")
    .addItem("匯入手動 URL", "importManualUrls")
    .addToUi();
}
