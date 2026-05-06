import TFA117 from "@/assets/trofeus/TFA117.jpg";
import TFA206 from "@/assets/trofeus/TFA206.jpg";
import TFA210 from "@/assets/trofeus/TFA210.jpg";
import TacaMDF from "@/assets/trofeus/Taca_MDF.png";
import Kit12Trofeus from "@/assets/trofeus/Kit12Trofeus.png";

const map: Record<string, string> = {
  TFA117,
  TFA206,
  TA206: TFA206,
  TFA210,
  "TAÇA MDF": TacaMDF,
  "TACA MDF": TacaMDF,
  "KIT 12 TROFÉUS DECORATIVOS": Kit12Trofeus,
  "KIT 12 TROFEUS DECORATIVOS": Kit12Trofeus,
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
