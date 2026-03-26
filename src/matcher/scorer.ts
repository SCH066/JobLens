import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { RawJob, ScoredJob } from "../types";
import { config } from "../config";
import { buildScoringPrompt } from "./prompt";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export async function scoreJobs(jobs: RawJob[]): Promise<ScoredJob[]> {
  // 讀取履歷和定位策略
  const resume = fs.readFileSync(config.resumePath, "utf-8");
  const positioning = fs.readFileSync(config.positioningPath, "utf-8");

  const results: ScoredJob[] = [];

  for (const job of jobs) {
    console.log(`  評分中: ${job.title} @ ${job.company}`);

    try {
      const prompt = buildScoringPrompt(job, resume, positioning);

      const message = await client.messages.create({
        model: config.model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      let text = message.content[0].type === "text" ? message.content[0].text : "";
      // 擷取第一個 JSON 物件
      const jsonMatch = text.match(/\{[\s\S]*?\n\}/);
      if (!jsonMatch) throw new Error("回應中找不到 JSON");
      const parsed = JSON.parse(jsonMatch[0]);

      results.push({
        ...job,
        score: parsed.score ?? 0,
        matchReason: parsed.matchReason ?? "",
        gaps: parsed.gaps ?? "",
        angle: parsed.angle ?? "",
      });
    } catch (err) {
      console.error(`  ⚠️ 評分失敗: ${job.title} — ${err}`);
      // 評分失敗給 0 分，不中斷流程
      results.push({
        ...job,
        score: 0,
        matchReason: "評分失敗",
        gaps: "",
        angle: "",
      });
    }
  }

  // 依分數高到低排序
  results.sort((a, b) => b.score - a.score);
  return results;
}
