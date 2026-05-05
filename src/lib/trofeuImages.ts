import TFA117 from "@/assets/trofeus/TFA117.jpg";
import TFA206 from "@/assets/trofeus/TFA206.jpg";
import TFA210 from "@/assets/trofeus/TFA210.jpg";
import TacaMDF from "@/assets/trofeus/Taca_MDF.png";

const map: Record<string, string> = {
  TFA117,
  TFA206,
  TA206: TFA206,
  TFA210,
  "TAÇA MDF": TacaMDF,
  "TACA MDF": TacaMDF,
};

export function getTrofeuImage(variation: string): string | null {
  const key = variation.trim().toUpperCase();
  if (map[key]) return map[key];
  // fuzzy: starts with
  for (const k of Object.keys(map)) {
    if (key.startsWith(k) || k.startsWith(key)) return map[k];
  }
  return null;
}
