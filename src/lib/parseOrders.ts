export type Item = { name: string; qty: number; unit?: string };
export type Variation = { variation: string; items: Item[] }; // e.g. "TFA117"
export type Section = {
  key: "trofeus" | "medalhas" | "mdf" | "outros";
  title: string;
  emoji: string;
  groups: Variation[]; // for trofeus, each group is a model; for others, single group with variation=""
};
export type DaySheet = { date: string; sections: Section[] };
export type ParseResult = { days: DaySheet[]; consolidated: Section[] | null };

const SECTION_MAP: Record<string, { key: Section["key"]; title: string; emoji: string }> = {
  "🏆": { key: "trofeus", title: "Troféus", emoji: "🏆" },
  "🏅": { key: "medalhas", title: "Medalhas", emoji: "🏅" },
  "🧱": { key: "mdf", title: "MDF Extra", emoji: "🧱" },
  "📊": { key: "outros", title: "Consolidado", emoji: "📊" },
};

const DAY_RE = /^📅\s*(.+)$/;
const SECTION_RE = /^(🏆|🏅|🧱)\s*(.+)$/;
const CONSOLIDATED_RE = /^📊/;
// "25 cm → 1" or "5 cm com fita (kit 30) → 120 un"
const ITEM_RE = /^(.+?)\s*(?:→|->)\s*([\d.,]+)\s*(\w+)?\s*$/;

export function parseOrders(input: string): ParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const days: DaySheet[] = [];
  let currentDay: DaySheet | null = null;
  let currentSection: Section | null = null;
  let currentVariation: Variation | null = null;
  let inConsolidated = false;
  let consolidatedSections: Section[] = [];

  const pushSection = () => {
    if (currentSection && currentDay && !inConsolidated) {
      currentDay.sections.push(currentSection);
    }
    if (currentSection && inConsolidated) {
      consolidatedSections.push(currentSection);
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ");

    if (CONSOLIDATED_RE.test(line)) {
      pushSection();
      currentSection = null;
      currentVariation = null;
      inConsolidated = true;
      continue;
    }

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      pushSection();
      currentSection = null;
      currentVariation = null;
      inConsolidated = false;
      currentDay = { date: dayMatch[1].trim(), sections: [] };
      days.push(currentDay);
      continue;
    }

    const secMatch = line.match(SECTION_RE);
    if (secMatch) {
      pushSection();
      const meta = SECTION_MAP[secMatch[1]];
      currentSection = {
        key: meta.key,
        title: secMatch[2].trim() || meta.title,
        emoji: meta.emoji,
        groups: [],
      };
      currentVariation = null;
      continue;
    }

    if (!currentSection) continue;

    const itemMatch = line.match(ITEM_RE);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const qty = parseFloat(itemMatch[2].replace(/\./g, "").replace(",", "."));
      const unit = itemMatch[3];
      if (!currentVariation) {
        currentVariation = { variation: "", items: [] };
        currentSection.groups.push(currentVariation);
      }
      currentVariation.items.push({ name, qty, unit });
    } else {
      // It's a variation header (e.g. "TFA117", "Taça MDF")
      currentVariation = { variation: line, items: [] };
      currentSection.groups.push(currentVariation);
    }
  }
  pushSection();

  return {
    days,
    consolidated: consolidatedSections.length ? consolidatedSections : null,
  };
}
