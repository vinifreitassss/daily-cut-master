import type { DaySheet, Section, Variation, Item } from "./parseOrders";

/**
 * Parser para a lista bruta da Shopee (texto colado direto da plataforma).
 * Estratégia:
 *  1. Quebra o texto em "blocos" — cada bloco começa em "ID do Pedido".
 *  2. Em cada bloco extrai:
 *      - data limite (regex "antes de DD/MM/AAAA")
 *      - cada par (linha-de-produto, linha-Variação, linha-xN) = um item
 *  3. Classifica por nome do produto e empilha em DaySheet[].
 */

export type ShopeeParseResult = {
  days: DaySheet[];
  unrecognized: string[]; // blocos que não bateram em nenhuma regra (para aviso)
};

type RawItem = {
  product: string;
  variation: string;
  multiplier: number; // o "xN" do pedido
};

type ClassifiedItem = {
  sectionKey: Section["key"];
  sectionTitle: string;
  sectionEmoji: string;
  variationGroup: string; // ex: "TFA117", "Taça MDF", "" (medalhas/mdf)
  itemName: string; // ex: "25 cm", "5 cm com fita (kit 30)"
  qty: number;
  unit?: string;
};

const DATE_RE = /antes de (\d{2}\/\d{2}\/\d{4})/i;
const ID_RE = /ID do Pedido\s+\S+/i;

function splitBlocks(input: string): string[] {
  // Divide em blocos por "ID do Pedido". Mantém o cabeçalho com cada bloco.
  const parts = input.split(/(?=ID do Pedido\s+\S+)/i);
  return parts.map((p) => p.trim()).filter((p) => ID_RE.test(p));
}

function extractDate(block: string): string {
  const m = block.match(DATE_RE);
  return m ? m[1] : "Sem data";
}

/**
 * Extrai todos os itens de um bloco.
 * Estratégia: percorre as linhas e para cada "xN" encontrada considera o
 * último produto visto (linha não-vazia que não é meta) e a última "Variação:"
 * (se houver) entre o produto e o "xN". Isso captura tanto pedidos com variação
 * quanto produtos novos sem variação (ex.: "Hand Grip ... \n x1").
 */
function extractRawItems(block: string): RawItem[] {
  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const items: RawItem[] = [];

  const isMeta = (s: string) =>
    !s ||
    /^Sob encomenda$/i.test(s) ||
    /^ID do Pedido/i.test(s) ||
    /^Variação:/i.test(s) ||
    /^x\d+$/i.test(s) ||
    /^Mensagem:?$/i.test(s);

  let lastProduct = "";
  let lastVariation = "";
  let productLineIdx = -1;
  let variationLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const varMatch = line.match(/^Variação:\s*(.+)$/i);
    if (varMatch) {
      lastVariation = varMatch[1].trim();
      variationLineIdx = i;
      continue;
    }

    const xMatch = line.match(/^x(\d+)$/i);
    if (xMatch) {
      const multiplier = parseInt(xMatch[1], 10) || 1;
      // Só consome a variação se ela apareceu DEPOIS do produto atual
      const variation = variationLineIdx > productLineIdx ? lastVariation : "";
      if (lastProduct) {
        items.push({ product: lastProduct, variation, multiplier });
      }
      // limpa variação para não vazar para o próximo item do mesmo bloco
      lastVariation = "";
      variationLineIdx = -1;
      continue;
    }

    // qualquer outra linha "real" é candidata a nome de produto
    if (!isMeta(line)) {
      lastProduct = line;
      productLineIdx = i;
    }
  }

  return items;
}

/** Mapeia produto + variação para uma ou várias linhas classificadas. */
function classify(raw: RawItem): ClassifiedItem[] {
  const product = raw.product.toLowerCase();
  const variation = raw.variation;
  const mult = raw.multiplier;

  // ============= MEDALHAS COM FITA (adesivadas) =============
  if (/medalh.*adesivad.*fita/i.test(product) || /medalh.*5 cm adesivad/i.test(product)) {
    // variação tipo "5 cm com fita,30" → kit de 30 → mult * 30 unidades
    const m = variation.match(/(.+?),\s*(\d+)/);
    if (m) {
      const tipo = m[1].trim(); // "5 cm com fita"
      const kit = parseInt(m[2], 10);
      return [
        {
          sectionKey: "medalhas",
          sectionTitle: "Medalhas",
          sectionEmoji: "🏅",
          variationGroup: "",
          itemName: `${tipo} (kit ${kit})`,
          qty: mult * kit,
          unit: "un",
        },
      ];
    }
    return [
      {
        sectionKey: "medalhas",
        sectionTitle: "Medalhas",
        sectionEmoji: "🏅",
        variationGroup: "",
        itemName: variation,
        qty: mult,
        unit: "un",
      },
    ];
  }

  // ============= MEDALHAS RESINADAS / CHAVEIROS DE MEDALHA =============
  // Só entra aqui se for medalha resinada OU chaveiro de medalha (kit numérico).
  if (/medalh.*resinad/i.test(product) || /medalh.*chaveir|chaveir.*medalh/i.test(product)) {
    const m = variation.match(/(.+?),\s*(\d+)/);
    if (m) {
      const tamanho = m[1].trim();
      const kit = parseInt(m[2], 10);
      if (!Number.isNaN(kit) && kit > 0) {
        return [
          {
            sectionKey: "medalhas",
            sectionTitle: "Medalhas",
            sectionEmoji: "🏅",
            variationGroup: "",
            itemName: `${tamanho} resinado (kit ${kit})`,
            qty: mult * kit,
            unit: "un",
          },
        ];
      }
    }
  }

  // ============= MEDALHA ACRÍLICO CRISTAL LISA (variação = nº do kit) =============
  // Ex: "Medalha Acrílico Cristal 2mm Redonda Lisa 8 cm Kit 50 - 100 unidades"
  // variação "30" / "50" / "100" → o número É o tamanho do kit.
  if (/medalh.*cristal|medalh.*lisa/i.test(product)) {
    const kit = parseInt(variation.trim(), 10);
    if (!Number.isNaN(kit) && kit > 0) {
      const sizeMatch = product.match(/(\d+)\s*cm/);
      const tamanho = sizeMatch ? `${sizeMatch[1]} cm cristal lisa` : "cristal lisa";
      return [
        {
          sectionKey: "medalhas",
          sectionTitle: "Medalhas",
          sectionEmoji: "🏅",
          variationGroup: "",
          itemName: `${tamanho} (kit ${kit})`,
          qty: mult * kit,
          unit: "un",
        },
      ];
    }
  }

  // ============= KIT 12 TROFÉUS DECORATIVOS (festa/totem) =============
  // Sem variação, qty multiplica por 12 unidades.
  if (/kit\s+12\s+trof[eé]us/i.test(product) || /trof[eé]us.*totem.*display/i.test(product)) {
    return [
      {
        sectionKey: "outros",
        sectionTitle: "Decoração / Festa",
        sectionEmoji: "🎉",
        variationGroup: "Kit 12 Troféus decorativos",
        itemName: "Kit 12 un",
        qty: mult * 12,
        unit: "un",
      },
    ];
  }

  // ============= KIT TROFÉUS (TFA117/206/210, TA206) =============
  // Ex: "kit Troféus de MDF e Acrílico ..." variação "TFA117,KIT 3 PÇS 25/21/18 CM"
  // Ex: "kit 3 Troféus Personalizados ... Tamanhos 20, 30, 40 cm" variação só "TFA206"
  if (/kit\s+trof[eé]us|kit\s+\d+\s+trof[eé]us/i.test(product)) {
    const parts = variation.split(",");
    const modelo = (parts[0] || "").trim().toUpperCase();
    const tamanhosRaw = (parts[1] || "").trim();

    // Tenta extrair tamanhos da variação. Importante: pular o "KIT N PÇS"
    // (o N seria capturado erroneamente como tamanho de 3/4/5 cm).
    let sizes: number[] = [];
    if (tamanhosRaw) {
      // Se o formato for "KIT N PÇS X/Y/Z CM", pega só o que vem depois de PÇS.
      const afterPcs = tamanhosRaw.match(/p[çc]s?\s*(.+)/i);
      const fonte = afterPcs ? afterPcs[1] : tamanhosRaw;
      sizes = (fonte.match(/\d+/g) || [])
        .map((s) => parseInt(s, 10))
        // tamanhos válidos de troféu: 15 cm ou mais. Filtra contagem/lixo.
        .filter((n) => n >= 15);
    }

    // Fallback: variação sem tamanhos (ex: "TFA206") — extrai do título do produto.
    if (modelo && !sizes.length) {
      const tituloSizes = (product.match(/\d+/g) || [])
        .map((s) => parseInt(s, 10))
        .filter((n) => n >= 15 && n <= 100);
      // remove duplicatas mantendo ordem
      sizes = Array.from(new Set(tituloSizes));
    }

    if (modelo && sizes.length) {
      return sizes.map((s) => ({
        sectionKey: "trofeus" as const,
        sectionTitle: "Troféus",
        sectionEmoji: "🏆",
        variationGroup: modelo,
        itemName: `${s} cm`,
        qty: mult,
      }));
    }
  }

  // ============= TROFÉU PERSONALIZADO 20cm LUXO (sem tamanho na variação) =============
  // Ex: produto "Troféu Personalizado 20cm em MDF ... LUXO" variação "TFA210" / "TFA117"
  if (/trof[eé]u personalizado.*20\s*cm.*luxo/i.test(product)) {
    const modelo = variation.trim().toUpperCase();
    return [
      {
        sectionKey: "trofeus",
        sectionTitle: "Troféus",
        sectionEmoji: "🏆",
        variationGroup: modelo,
        itemName: "20 cm",
        qty: mult,
      },
    ];
  }

  // ============= TROFÉU MDF 35cm (TFA210 / TA206 com tamanho indicado) =============
  // Ex: variação "TFA210,3" ou "TA206,1" — esses pedidos do "Troféu de MDF 35cm" são todos 35 cm
  if (/trof[eé]u de mdf 35\s*cm/i.test(product)) {
    const modelo = (variation.split(",")[0] || "").trim().toUpperCase();
    return [
      {
        sectionKey: "trofeus",
        sectionTitle: "Troféus",
        sectionEmoji: "🏆",
        variationGroup: modelo || variation,
        itemName: "35 cm",
        qty: mult,
      },
    ];
  }

  // ============= TAÇA MDF (Troféu de MDF 60cm / Taça Dourado) =============
  // Ex: produto "Troféu de MDF 60cm ... Taça Dourado" variação "30cm" / "40cm" / "50cm" / "60cm"
  if (/trof[eé]u de mdf.*ta[çc]a/i.test(product) || /ta[çc]a dourado/i.test(product)) {
    const m = variation.match(/(\d+)\s*cm/i);
    if (m) {
      return [
        {
          sectionKey: "trofeus",
          sectionTitle: "Troféus",
          sectionEmoji: "🏆",
          variationGroup: "Taça MDF",
          itemName: `${m[1]} cm`,
          qty: mult,
        },
      ];
    }
  }

  // ============= PLACAS =============
  if (/placa.*sinaliza|placa personalizada/i.test(product)) {
    return [
      {
        sectionKey: "mdf",
        sectionTitle: "MDF Extra",
        sectionEmoji: "🧱",
        variationGroup: "",
        itemName: `Placas ${variation}`,
        qty: mult,
      },
    ];
  }

  // ============= RIPAS =============
  if (/ripas/i.test(product)) {
    return [
      {
        sectionKey: "mdf",
        sectionTitle: "MDF Extra",
        sectionEmoji: "🧱",
        variationGroup: "",
        itemName: `Ripas (kit ${variation})`,
        qty: mult,
        unit: "kit",
      },
    ];
  }

  // ============= TOTENS =============
  if (/totens|totem/i.test(product)) {
    return [
      {
        sectionKey: "mdf",
        sectionTitle: "MDF Extra",
        sectionEmoji: "🧱",
        variationGroup: "",
        itemName: `Totens ${variation}`,
        qty: mult,
        unit: "un",
      },
    ];
  }

  // Fallback: joga em "outros" usando o nome do produto como rótulo.
  // Encurta nomes muito longos para caber bem na ordem de corte impressa.
  const shortName = raw.product.length > 60 ? raw.product.slice(0, 57) + "…" : raw.product;
  const label = variation ? `${shortName} — ${variation}` : shortName;
  return [
    {
      sectionKey: "outros",
      sectionTitle: "Outros",
      sectionEmoji: "📦",
      variationGroup: "",
      itemName: label,
      qty: mult,
      unit: "un",
    },
  ];
}

/** Adiciona um item classificado ao mapa de dias, somando quantidades. */
function addToDay(daysMap: Map<string, DaySheet>, date: string, ci: ClassifiedItem) {
  let day = daysMap.get(date);
  if (!day) {
    day = { date, sections: [] };
    daysMap.set(date, day);
  }
  let section = day.sections.find((s) => s.key === ci.sectionKey);
  if (!section) {
    section = {
      key: ci.sectionKey,
      title: ci.sectionTitle,
      emoji: ci.sectionEmoji,
      groups: [],
    };
    day.sections.push(section);
  }
  let group: Variation | undefined = section.groups.find((g) => g.variation === ci.variationGroup);
  if (!group) {
    group = { variation: ci.variationGroup, items: [] };
    section.groups.push(group);
  }
  const existing = group.items.find(
    (it) => it.name === ci.itemName && (it.unit || "") === (ci.unit || "")
  );
  if (existing) {
    existing.qty += ci.qty;
  } else {
    const item: Item = { name: ci.itemName, qty: ci.qty, unit: ci.unit };
    group.items.push(item);
  }
}

/** Ordena dias por data (DD/MM/AAAA crescente; "Sem data" no fim). */
function sortDays(days: DaySheet[]): DaySheet[] {
  return [...days].sort((a, b) => {
    if (a.date === "Sem data") return 1;
    if (b.date === "Sem data") return -1;
    const [da, ma, ya] = a.date.split("/").map((n) => parseInt(n, 10));
    const [db, mb, yb] = b.date.split("/").map((n) => parseInt(n, 10));
    return (
      new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
    );
  });
}

/** Ordena seções dentro de cada dia: troféus, medalhas, mdf, outros. */
function sortSections(day: DaySheet): DaySheet {
  const order: Section["key"][] = ["trofeus", "medalhas", "mdf", "outros"];
  return {
    ...day,
    sections: [...day.sections].sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key)
    ),
  };
}

export function parseShopeeOrders(input: string): ShopeeParseResult {
  const blocks = splitBlocks(input);
  const daysMap = new Map<string, DaySheet>();
  const unrecognized: string[] = [];

  for (const block of blocks) {
    const date = extractDate(block);
    const rawItems = extractRawItems(block);
    if (!rawItems.length) {
      const idMatch = block.match(/ID do Pedido\s+(\S+)/i);
      unrecognized.push(idMatch ? idMatch[1] : block.slice(0, 60));
      continue;
    }
    for (const raw of rawItems) {
      const classified = classify(raw);
      for (const ci of classified) {
        addToDay(daysMap, date, ci);
      }
    }
  }

  const days = sortDays(Array.from(daysMap.values())).map(sortSections);
  return { days, unrecognized };
}
