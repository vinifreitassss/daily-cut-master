import { useMemo, useState } from "react";
import type { PrintDay, PrintItem } from "@/lib/parseShopeeOrders";
import { usePrintChecklist, type PrintChecklistState } from "@/lib/printChecklist";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  days: PrintDay[];
};

type HistoryOrder = {
  orderId: string;
  date: string;
  items: (PrintItem & { done: boolean; doneAt: string | null })[];
};

function buildHistoryOrders(
  state: PrintChecklistState,
  visibleKeys: Set<string>
): HistoryOrder[] {
  const out: HistoryOrder[] = [];
  for (const [orderId, items] of Object.entries(state)) {
    let date = "Sem data";
    const itemList: HistoryOrder["items"] = [];
    for (const [key, entry] of Object.entries(items)) {
      if (visibleKeys.has(key)) continue; // já aparece na lista atual
      date = entry.date || date;
      itemList.push({
        key,
        orderId,
        product: entry.product,
        variation: entry.variation,
        qty: entry.qty,
        done: entry.done,
        doneAt: entry.doneAt,
      });
    }
    if (itemList.length) out.push({ orderId, date, items: itemList });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function PrintSheet({ days }: Props) {
  const { state, isDone, toggle, getEntry, clearOrders } = usePrintChecklist();
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const visibleKeys = useMemo(() => {
    const s = new Set<string>();
    for (const d of days) for (const o of d.orders) for (const it of o.items) s.add(it.key);
    return s;
  }, [days]);

  const historyOrders = useMemo(
    () => (showHistory ? buildHistoryOrders(state, visibleKeys) : []),
    [showHistory, state, visibleKeys]
  );

  const handleToggle = (it: PrintItem, date: string) => {
    toggle(it.orderId, it.key, {
      product: it.product,
      variation: it.variation,
      qty: it.qty,
      date,
    });
  };

  const currentOrderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of days) for (const o of d.orders) ids.add(o.orderId);
    return Array.from(ids);
  }, [days]);

  const doPrint = () => {
    document.body.classList.add("print-sheet-mode");
    const cleanup = () => {
      document.body.classList.remove("print-sheet-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // fallback for browsers without afterprint
    setTimeout(cleanup, 1500);
  };

  const allCount = useMemo(
    () => days.reduce((s, d) => s + d.orders.reduce((a, o) => a + o.items.length, 0), 0),
    [days]
  );
  const doneCount = useMemo(() => {
    let c = 0;
    for (const d of days)
      for (const o of d.orders)
        for (const it of o.items) if (isDone(it.orderId, it.key)) c++;
    return c;
  }, [days, isDone]);

  if (!days.length && !historyOrders.length) {
    return (
      <p className="text-sm text-muted-foreground p-4 text-center">
        Nenhum item personalizado encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sm mr-2">
          {doneCount} / {allCount} impressos
        </span>
        <Button
          size="sm"
          variant={pendingOnly ? "default" : "outline"}
          onClick={() => setPendingOnly((v) => !v)}
        >
          {pendingOnly ? "✓ Só pendentes" : "Só pendentes"}
        </Button>
        <Button
          size="sm"
          variant={showHistory ? "default" : "outline"}
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "✓ Histórico" : "Mostrar histórico"}
        </Button>
        <Button size="sm" variant="secondary" onClick={doPrint}>
          🖨️ Imprimir folha
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (confirm("Limpar marcações dos pedidos deste lote?")) clearOrders(currentOrderIds);
          }}
        >
          🧹 Limpar lote
        </Button>
      </div>

      {/* Área rolável de leitura na tela */}
      <div className="no-print overflow-auto border rounded-md max-h-[60vh]">
        {days.map((day) => {
          const dayItems = day.orders.flatMap((o) => o.items);
          const dayDone = dayItems.filter((it) => isDone(it.orderId, it.key)).length;
          const visibleOrders = pendingOnly
            ? day.orders
                .map((o) => ({
                  ...o,
                  items: o.items.filter((it) => !isDone(it.orderId, it.key)),
                }))
                .filter((o) => o.items.length)
            : day.orders;
          if (!visibleOrders.length) return null;
          return (
            <div key={day.date} className="border-b last:border-b-0">
              <div className="bg-muted px-3 py-2 flex items-center justify-between sticky top-0">
                <span className="font-bold text-sm">📅 Postar até {day.date}</span>
                <span className="text-xs text-muted-foreground">
                  {dayDone}/{dayItems.length} impressos
                </span>
              </div>
              <div className="divide-y">
                {visibleOrders.map((o) => (
                  <div key={o.orderId} className="px-3 py-2">
                    <div className="text-xs font-semibold mb-1 flex items-center gap-2">
                      <span>Pedido {o.orderId}</span>
                      {o.urgencyLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                          ⚡ {o.urgencyLabel}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {o.items.map((it) => {
                        const done = isDone(it.orderId, it.key);
                        const entry = getEntry(it.orderId, it.key);
                        return (
                          <li key={it.key} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={done}
                              onCheckedChange={() => handleToggle(it, day.date)}
                              className="mt-0.5"
                            />
                            <div className={done ? "line-through text-muted-foreground flex-1" : "flex-1"}>
                              <span className="font-mono font-semibold">{it.qty}x </span>
                              <span>{it.product}</span>
                              {it.variation && (
                                <span className="text-muted-foreground"> — {it.variation}</span>
                              )}
                              {done && entry?.doneAt && (
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                  ✓ {new Date(entry.doneAt).toLocaleString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {showHistory && historyOrders.length > 0 && (
          <div className="border-t">
            <div className="bg-amber-500/10 px-3 py-2 sticky top-0">
              <span className="font-bold text-sm">📚 Histórico — pedidos antigos</span>
            </div>
            <div className="divide-y">
              {historyOrders.map((o) => (
                <div key={`h-${o.orderId}`} className="px-3 py-2">
                  <div className="text-xs font-semibold mb-1">
                    Pedido {o.orderId} · {o.date}
                  </div>
                  <ul className="space-y-1">
                    {o.items.map((it) => (
                      <li key={it.key} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={it.done}
                          onCheckedChange={() =>
                            toggle(it.orderId, it.key, {
                              product: it.product,
                              variation: it.variation,
                              qty: it.qty,
                              date: o.date,
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className={it.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>
                          <span className="font-mono font-semibold">{it.qty}x </span>
                          <span>{it.product}</span>
                          {it.variation && (
                            <span className="text-muted-foreground"> — {it.variation}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Versão imprimível — fora da tela, visível apenas via body.print-sheet-mode */}
      <PrintableSheet days={days} pendingOnly={pendingOnly} isDone={isDone} />
    </div>
  );
}

function PrintableSheet({
  days,
  pendingOnly,
  isDone,
}: {
  days: PrintDay[];
  pendingOnly: boolean;
  isDone: (orderId: string, key: string) => boolean;
}) {
  return (
    <div className="print-sheet-only" aria-hidden="true">
      <h1 style={{ fontSize: "14pt", fontWeight: 800, marginBottom: 4 }}>
        Lista de Impressão — Personalizados
      </h1>
      <p style={{ fontSize: "9pt", marginBottom: 12, color: "#555" }}>
        Gerado em {new Date().toLocaleString("pt-BR")} — marque cada item após imprimir
      </p>
      {days.map((day) => {
        const orders = pendingOnly
          ? day.orders
              .map((o) => ({
                ...o,
                items: o.items.filter((it) => !isDone(it.orderId, it.key)),
              }))
              .filter((o) => o.items.length)
          : day.orders;
        if (!orders.length) return null;
        return (
          <div key={day.date} style={{ marginBottom: 12, pageBreakInside: "avoid" }}>
            <h2
              style={{
                fontSize: "11pt",
                fontWeight: 700,
                borderBottom: "1.5px solid #000",
                marginBottom: 4,
                paddingBottom: 2,
              }}
            >
              📅 Postar até {day.date}
            </h2>
            {orders.map((o) => (
              <div key={o.orderId} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: "9pt", fontWeight: 600 }}>
                  Pedido {o.orderId}
                  {o.urgencyLabel ? `  ⚡ ${o.urgencyLabel}` : ""}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {o.items.map((it) => (
                    <li
                      key={it.key}
                      style={{
                        fontSize: "9pt",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        padding: "1px 0",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          border: "1.2px solid #000",
                          marginTop: 3,
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        <strong>{it.qty}x</strong> {it.product}
                        {it.variation ? ` — ${it.variation}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
