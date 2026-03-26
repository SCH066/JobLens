import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  // Claude API
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  model: "claude-haiku-4-5-20251001" as const, // 最便宜，評分夠用

  // Obsidian Vault
  vaultPath: process.env.VAULT_PATH || "",
  kanbanPath: "", // 動態計算
  jobsDir: "", // 動態計算
  outputDir: "", // 動態計算

  // Google Sheet CSV（Apps Script 寫入的職缺來源）
  sheetCsvUrl: process.env.SHEET_CSV_URL || "",

  // 過濾
  keywords: {
    // 白名單：至少命中一個才保留
    include: ["AI", "LLM", "NLP", "機器學習", "深度學習", "自動化", "n8n", "workflow", "Claude", "GPT", "agent"],
    // 黑名單：命中任一個就排除
    exclude: ["硬體", "韌體", "FPGA", "IC 設計"],
  },

  // 評分門檻
  scoreThreshold: 60,

  // 資料路徑
  resumePath: path.resolve("data/resume-base.md"),
  positioningPath: path.resolve("data/positioning.md"),
};

// 動態計算 Obsidian 路徑
config.kanbanPath = path.join(config.vaultPath, "JobLens/kanban.md");
config.jobsDir = path.join(config.vaultPath, "JobLens/jobs");
config.outputDir = path.join(config.vaultPath, "JobLens/output");
