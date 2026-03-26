import fs from "fs";
import path from "path";
import { ScoredJob } from "../types";
import { config } from "../config";
import { jobDetailName } from "../kanban/writer";

// 產出單筆職缺的詳情 .md 檔
function buildJobDetailMd(job: ScoredJob): string {
  return `---
company: "${job.company}"
title: "${job.title}"
score: ${job.score}
location: "${job.location}"
salary: "${job.salary}"
date: "${job.appearDate}"
link: "${job.link}"
---

# ${job.title} @ ${job.company}

## 基本資訊
- **公司**：${job.company}
- **地點**：${job.location}
- **薪資**：${job.salary}
- **刊登日期**：${job.appearDate}
- **連結**：[104 職缺頁面](${job.link})

## AI 匹配分析

**匹配度：${job.score} / 100**

### 匹配亮點
${job.matchReason}

### 缺口與風險
${job.gaps}

### 建議切角
${job.angle}

## 職缺描述
${job.description}
`;
}

// 批次產出所有職缺的詳情檔
export async function writeJobDetails(jobs: ScoredJob[]): Promise<void> {
  fs.mkdirSync(config.jobsDir, { recursive: true });

  for (const job of jobs) {
    const fileName = `${jobDetailName(job)}.md`;
    const filePath = path.join(config.jobsDir, fileName);
    const content = buildJobDetailMd(job);
    fs.writeFileSync(filePath, content, "utf-8");
  }

  console.log(`  產出 ${jobs.length} 筆詳情檔到 ${config.jobsDir}/`);
}
