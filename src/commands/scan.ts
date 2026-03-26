import { fetchJobs } from "../scrapers/rss-104";
import { filterJobs } from "../filter";
import { scoreJobs } from "../matcher/scorer";
import { writeToKanban } from "../kanban/writer";
import { writeJobDetails } from "../output/job-detail";
import { config } from "../config";
import { ScoredJob } from "../types";

export async function scanCommand() {
  const noScore = process.argv.includes("--no-score");

  // 1. 抓取職缺
  console.log("📡 抓取 104 職缺...");
  const rawJobs = await fetchJobs();
  console.log(`  找到 ${rawJobs.length} 筆職缺`);

  // 2. 過濾
  console.log("🔍 關鍵字過濾...");
  const filtered = filterJobs(rawJobs);
  console.log(`  過濾後剩 ${filtered.length} 筆`);

  if (filtered.length === 0) {
    console.log("沒有符合條件的職缺，結束。");
    return;
  }

  let results: ScoredJob[];

  if (noScore) {
    // 跳過評分，給預設值
    console.log("⏭️  跳過 AI 評分（--no-score 模式）");
    results = filtered.map((j) => ({
      ...j,
      score: 0,
      matchReason: "待評分",
      gaps: "待評分",
      angle: "待評分",
    }));
  } else {
    // 3. Claude 評分
    if (!config.anthropicApiKey) {
      console.error("❌ 未設定 ANTHROPIC_API_KEY，請在 .env 中設定，或用 --no-score 跳過評分");
      process.exit(1);
    }
    console.log("🤖 Claude AI 匹配評分...");
    results = await scoreJobs(filtered);
    results = results.filter((j) => j.score >= config.scoreThreshold);
    console.log(`  評分完成，${results.length} 筆超過門檻 (${config.scoreThreshold} 分)`);

    if (results.length === 0) {
      console.log("沒有超過門檻的職缺，結束。");
      return;
    }
  }

  // 4. 產出 job detail .md
  console.log("📝 產出職缺詳情...");
  await writeJobDetails(results);

  // 5. 寫入 Kanban
  console.log("📋 寫入 Obsidian Kanban...");
  await writeToKanban(results);

  console.log(`\n✅ 完成！${results.length} 筆職缺已寫入看板。`);
  console.log(`  看板: ${config.kanbanPath}`);
  console.log(`  詳情: ${config.jobsDir}/`);
}
