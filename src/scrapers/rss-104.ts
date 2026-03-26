// 104 人力銀行職缺抓取
// 資料來源：Google Sheet CSV（由 Apps Script 從 Gmail 自動匯入）
// 補完方式：104 職缺詳情 API
import fs from "fs";
import path from "path";
import { RawJob } from "../types";
import { config } from "../config";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

// 簡易 CSV parser（不引入額外依賴）
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

// 解析單行 CSV（處理引號內的逗號）
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// 用詳情 API 抓單筆職缺的完整資訊
async function fetchJobDetail(jobId: string): Promise<RawJob | null> {
  const url = `https://www.104.com.tw/job/ajax/content/${jobId}`;
  const res = await fetch(url, {
    headers: {
      ...HEADERS,
      Referer: `https://www.104.com.tw/job/${jobId}`,
    },
  });

  if (!res.ok) {
    console.error(`  ⚠️ 詳情 API 失敗 (${jobId}): ${res.status}`);
    return null;
  }

  const json = await res.json();
  const data = json?.data;
  if (!data) return null;

  const header = data.header || {};
  const detail = data.jobDetail || {};
  const condition = data.condition || {};
  const welfare = data.welfare || {};

  const descParts = [
    detail.jobDescription || "",
    condition.other || "",
    welfare.welfare || "",
  ].filter(Boolean);

  return {
    jobNo: jobId,
    title: header.jobName || "",
    company: header.custName || "",
    location: header.jobAddrNoDesc || header.addr || "",
    salary: header.salaryDesc || "",
    description: descParts.join("\n\n"),
    link: `https://www.104.com.tw/job/${jobId}`,
    appearDate: header.appearDate || "",
    tags: (condition.skill || []).map((s: any) => s.description || ""),
  };
}

// 從 Google Sheet CSV 讀取職缺列表，再用詳情 API 補完
export async function fetchJobs(): Promise<RawJob[]> {
  // 來源 1：Google Sheet CSV
  let sheetJobs: { jobId: string; status: string }[] = [];

  if (config.sheetCsvUrl) {
    console.log("  讀取 Google Sheet...");
    const res = await fetch(config.sheetCsvUrl);
    if (res.ok) {
      const csv = await res.text();
      const rows = parseCsv(csv);
      sheetJobs = rows
        .filter((r) => r["Job ID"] && r["狀態"] === "待處理")
        .map((r) => ({ jobId: r["Job ID"], status: r["狀態"] }));
      console.log(`  Sheet 中有 ${sheetJobs.length} 筆待處理職缺`);
    } else {
      console.error(`  ⚠️ 無法讀取 Google Sheet: ${res.status}`);
    }
  }

  // 來源 2：本地 jobs-input.md（手動補漏）
  const inputPath = path.resolve("data/jobs-input.md");
  const manualJobIds: string[] = [];

  if (fs.existsSync(inputPath)) {
    const content = fs.readFileSync(inputPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    for (const line of lines) {
      const match = line.match(/104\.com\.tw\/job\/([a-zA-Z0-9]+)/);
      if (match) manualJobIds.push(match[1]);
    }
    if (manualJobIds.length > 0) {
      console.log(`  手動輸入有 ${manualJobIds.length} 筆`);
    }
  }

  // 合併去重
  const allJobIds = new Set<string>();
  const jobIdList: string[] = [];

  for (const { jobId } of sheetJobs) {
    if (!allJobIds.has(jobId)) {
      allJobIds.add(jobId);
      jobIdList.push(jobId);
    }
  }
  for (const jobId of manualJobIds) {
    if (!allJobIds.has(jobId)) {
      allJobIds.add(jobId);
      jobIdList.push(jobId);
    }
  }

  if (jobIdList.length === 0) {
    console.log("  沒有待處理的職缺。");
    return [];
  }

  // 用詳情 API 逐筆抓取完整資訊
  const jobs: RawJob[] = [];

  for (const jobId of jobIdList) {
    console.log(`  抓取詳情: ${jobId}...`);
    const job = await fetchJobDetail(jobId);
    if (job) {
      jobs.push(job);
    }
    // 禮貌延遲
    await new Promise((r) => setTimeout(r, 500));
  }

  return jobs;
}
