import { RawJob } from "../types";

export function buildScoringPrompt(job: RawJob, resume: string, positioning: string): string {
  return `你是一個求職匹配分析師。根據以下候選人資料和職缺資訊，評估匹配程度。

## 候選人履歷
${resume}

## 候選人定位策略
${positioning}

## 職缺資訊
- 職稱：${job.title}
- 公司：${job.company}
- 地點：${job.location}
- 薪資：${job.salary}
- 描述：${job.description}

## 請回覆以下 JSON 格式（不要加 markdown code block）：
{
  "score": 0-100 的整數,
  "matchReason": "2-3 個匹配亮點，用頓號分隔",
  "gaps": "1-2 個缺口或風險，用頓號分隔",
  "angle": "建議的應徵切角，一句話"
}

評分標準：
- 90+：幾乎完美匹配，經驗和技能高度吻合
- 70-89：主要技能匹配，有些缺口可透過包裝彌補
- 50-69：部分匹配，需要較多包裝和學習
- 50 以下：匹配度低，不建議投遞`;
}
