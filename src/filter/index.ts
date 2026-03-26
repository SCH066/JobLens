import { RawJob } from "../types";
import { config } from "../config";

// 已處理過的職缺（去重用）
const seenJobNos = new Set<string>();

export function filterJobs(jobs: RawJob[]): RawJob[] {
  return jobs.filter((job) => {
    // 去重
    if (seenJobNos.has(job.jobNo)) return false;
    seenJobNos.add(job.jobNo);

    // 黑名單：命中任一個就排除
    const text = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
    const hitBlacklist = config.keywords.exclude.some((kw) => text.includes(kw.toLowerCase()));
    if (hitBlacklist) return false;

    // 手動輸入模式：不需要白名單過濾（你貼的都是有興趣的）
    return true;
  });
}
