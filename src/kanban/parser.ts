import fs from "fs";

export interface KanbanData {
  frontmatter: string;
  sections: Map<string, string[]>; // 欄位名 → 卡片內容陣列
  raw: string;
}

// 解析 kanban.md，取得各欄的卡片
export function parseKanban(filePath: string): KanbanData {
  if (!fs.existsSync(filePath)) {
    // 不存在就回傳空看板結構
    return {
      frontmatter: "---\nkanban-plugin: basic\n---",
      sections: new Map([
        ["待審核", []],
        ["審核通過", []],
        ["已產出", []],
      ]),
      raw: "",
    };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  let frontmatter = "";
  const sections = new Map<string, string[]>();
  let currentSection = "";
  let inFrontmatter = false;
  let frontmatterDone = false;
  let currentCard: string[] = [];

  for (const line of lines) {
    // 處理 frontmatter
    if (line.trim() === "---" && !frontmatterDone) {
      if (!inFrontmatter) {
        inFrontmatter = true;
        frontmatter += line + "\n";
        continue;
      } else {
        frontmatter += line;
        frontmatterDone = true;
        inFrontmatter = false;
        continue;
      }
    }
    if (inFrontmatter) {
      frontmatter += line + "\n";
      continue;
    }

    // ## 開頭 = 新欄位
    if (line.startsWith("## ")) {
      // 儲存前一個 card
      if (currentSection && currentCard.length > 0) {
        const cards = sections.get(currentSection) || [];
        cards.push(currentCard.join("\n"));
        sections.set(currentSection, cards);
      }
      currentSection = line.replace("## ", "").trim();
      currentCard = [];
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    // - [ ] 開頭 = 新卡片
    if (line.match(/^- \[[ x]\] /)) {
      // 儲存前一張卡片
      if (currentCard.length > 0 && currentSection) {
        const cards = sections.get(currentSection) || [];
        cards.push(currentCard.join("\n"));
        sections.set(currentSection, cards);
      }
      currentCard = [line];
      continue;
    }

    // 卡片的續行（縮排內容）
    if (currentCard.length > 0 && line.match(/^\s+/)) {
      currentCard.push(line);
    }
  }

  // 最後一張卡片
  if (currentSection && currentCard.length > 0) {
    const cards = sections.get(currentSection) || [];
    cards.push(currentCard.join("\n"));
    sections.set(currentSection, cards);
  }

  return { frontmatter, sections, raw };
}

// 從看板取得已存在的 jobNo（去重用）
export function getExistingJobNos(kanban: KanbanData): Set<string> {
  const nos = new Set<string>();
  for (const [, cards] of kanban.sections) {
    for (const card of cards) {
      // 從連結中提取 jobNo：[[jobs/2026-03-26-xxx|詳情]] 或 (https://www.104.com.tw/job/xxxxx)
      const linkMatch = card.match(/104\.com\.tw\/job\/(\w+)/);
      if (linkMatch) nos.add(linkMatch[1]);
    }
  }
  return nos;
}
