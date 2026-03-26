// 從 104 API 抓到的原始職缺
export interface RawJob {
  jobNo: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  link: string;
  appearDate: string;
  tags: string[];
}

// 經過 Claude 評分後的職缺
export interface ScoredJob extends RawJob {
  score: number;
  matchReason: string; // 匹配原因
  gaps: string; // 缺口分析
  angle: string; // 建議切角
}
