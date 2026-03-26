import fs from "fs";
import path from "path";
import { ScoredJob } from "../types";
import { config } from "../config";
import { parseKanban, getExistingJobNos } from "./parser";

// 產出日期 slug（用於檔名）
function dateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

// 公司名轉 slug（簡化處理）
function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

// 產出職缺的 detail 檔名（不含副檔名）
export function jobDetailName(job: ScoredJob): string {
  return `${dateSlug()}-${companySlug(job.company)}-${companySlug(job.title)}`;
}

// 分數對應的 tag
function scoreTag(score: number): string {
  if (score >= 80) return "#high";
  if (score >= 60) return "#medium";
  return "#low";
}

// 產出一張卡片的 markdown
function buildCard(job: ScoredJob): string {
  const detailName = jobDetailName(job);
  const lines = [
    `- [ ] **${job.title} @ ${job.company}** — Score: ${job.score} ${scoreTag(job.score)}`,
    `  - 匹配：${job.matchReason}`,
    `  - 缺口：${job.gaps}`,
    `  - [[JobLens/jobs/${detailName}|詳情]]`,
    `  - [職缺連結](${job.link})`,
  ];
  return lines.join("\n");
}

// 寫入新卡片到 kanban.md 的「待審核」欄
export async function writeToKanban(jobs: ScoredJob[]): Promise<void> {
  // 確保目錄存在
  const kanbanDir = path.dirname(config.kanbanPath);
  fs.mkdirSync(kanbanDir, { recursive: true });

  // 解析現有看板
  const kanban = parseKanban(config.kanbanPath);
  const existingNos = getExistingJobNos(kanban);

  // 過濾已存在的職缺
  const newJobs = jobs.filter((j) => !existingNos.has(j.jobNo));
  if (newJobs.length === 0) {
    console.log("  所有職缺都已在看板中，跳過。");
    return;
  }

  // 產出新卡片
  const newCards = newJobs.map(buildCard);

  // 組合看板
  const pendingCards = [...(kanban.sections.get("待審核") || []), ...newCards];
  const approvedCards = kanban.sections.get("審核通過") || [];
  const doneCards = kanban.sections.get("已產出") || [];

  const output = [
    kanban.frontmatter,
    "",
    "## 待審核",
    "",
    ...pendingCards,
    "",
    "## 審核通過",
    "",
    ...approvedCards,
    "",
    "## 已產出",
    "",
    ...doneCards,
    "",
  ].join("\n");

  fs.writeFileSync(config.kanbanPath, output, "utf-8");
  console.log(`  新增 ${newJobs.length} 筆職缺到看板。`);
}
