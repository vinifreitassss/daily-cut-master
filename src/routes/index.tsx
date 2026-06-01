import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { parseOrders, buildConsolidated, type ParseResult } from "@/lib/parseOrders";
import {
  parseShopeeOrders,
  extractShopeeOrdersList,
  formatOrdersAsText,
  extractPriorityList,
  formatPriorityAsText,
  extractPriorityOrderSheets,
  type PriorityItem,
  type PriorityOrderSheet,
} from "@/lib/parseShopeeOrders";
import {
  ConsolidatedSheet,
  DayBlock,
  DaysGrid,
  PriorityOrderBlock,
  PriorityGrid,
} from "@/components/OrderSheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Ordem de Corte — Silva Campos Esportes" },
      {
        name: "description",
        content:
          "Cole sua lista de pedidos e gere uma ordem de corte organizada para impressão.",
      },
    ],
  }),
});

const EXAMPLE_STRUCTURED = `📅 06/05/2026

🏆 Troféus
TFA117
25 cm → 1
21 cm → 1
18 cm → 1

Taça MDF
30 cm → 3
50 cm → 3

🏅 Medalhas
5 cm com fita (kit 30) → 120 un`;

const EXAMPLE_RAW = `raianeevelinromisdosreis
ID do Pedido 260424NHMG4NNH
Sob encomenda
Kit Medalhas Personalizadas de acrílico de 5 cm Adesivadas com Fita Diversas Quantidades
Variação: 5 cm com fita,30
x2
R$139,25
Por favor, envie o pedido antes de 06/05/2026 para evitar o cancelamento automático.`;

type Mode = "structured" | "raw";

function Index() {
  const [mode, setMode] = useState<Mode>("structured");
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<{ mode: Mode; text: string } | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [viewByPriority, setViewByPriority] = useState(false);

  const priorityItems = useMemo<PriorityItem[]>(() => {
    if (!submitted || submitted.mode !== "raw") return [];
    return extractPriorityList(submitted.text);
  }, [submitted]);

  const prioritySheets = useMemo<PriorityOrderSheet[]>(() => {
    if (!submitted || submitted.mode !== "raw") return [];
    return extractPriorityOrderSheets(submitted.text);
  }, [submitted]);

  const { result, unrecognized } = useMemo<{
    result: ParseResult | null;
    unrecognized: string[];
  }>(() => {
    if (!submitted) return { result: null, unrecognized: [] };
    if (submitted.mode === "structured") {
      return { result: parseOrders(submitted.text), unrecognized: [] };
    }
    const r = parseShopeeOrders(submitted.text);
    return {
      result: { days: r.days, consolidated: buildConsolidated(r.days) },
      unrecognized: r.unrecognized,
    };
  }, [submitted]);

  const handleGenerate = () => setSubmitted({ mode, text });
  const handleClear = () => {
    setText("");
    setSubmitted(null);
  };

  const placeholder = mode === "structured" ? EXAMPLE_STRUCTURED : EXAMPLE_RAW;
  const example = mode === "structured" ? EXAMPLE_STRUCTURED : EXAMPLE_RAW;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-foreground/15 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">📋 Ordem de Corte</h1>
            <p className="text-xs text-muted-foreground">Cole a lista, gere e imprima</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>
              Limpar
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={!text.trim()}>
              Gerar
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => window.print()}
              disabled={!result}
            >
              🖨 Imprimir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const orders = extractShopeeOrdersList(submitted!.text);
                const txt = formatOrdersAsText(orders);
                const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={!result || !submitted || submitted.mode !== "raw"}
            >
              📄 Lista de pedidos (.txt)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPriorityOpen(true)}
              disabled={!result || !submitted || submitted.mode !== "raw" || priorityItems.length === 0}
            >
              🔥 Ordem de prioridade
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!result && (
          <section className="no-print">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-4">
              <TabsList>
                <TabsTrigger value="structured">📋 Lista estruturada</TabsTrigger>
                <TabsTrigger value="raw">🛒 Pedidos brutos (Shopee)</TabsTrigger>
              </TabsList>
              <TabsContent value="structured">
                <p className="text-xs text-muted-foreground mb-2">
                  Cole o texto já organizado por <code>📅 data</code>,{" "}
                  <code>🏆/🏅/🧱</code> e <code>tamanho → qtd</code>.
                </p>
              </TabsContent>
              <TabsContent value="raw">
                <p className="text-xs text-muted-foreground mb-2">
                  Cole o texto cru direto da Shopee. O app extrai data, produto, variação e
                  quantidade automaticamente.
                </p>
              </TabsContent>
            </Tabs>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={!text.trim()}>
                Gerar Ordem de Corte
              </Button>
              <button
                type="button"
                className="text-xs underline text-muted-foreground"
                onClick={() => setText(example)}
              >
                Carregar exemplo
              </button>
            </div>
          </section>
        )}

        {result && (
          <div className="print-area">
            <div className="mb-4 flex items-end justify-between border-b-2 border-foreground pb-3">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Ordem de Corte</h1>
                <p className="text-xs text-muted-foreground">
                  Gerado em {new Date().toLocaleDateString("pt-BR")} — {result.days.length}{" "}
                  dia(s)
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Silva Campos Esportes</div>
              </div>
            </div>

            {unrecognized.length > 0 && (
              <div className="no-print mb-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                <strong>⚠️ {unrecognized.length} pedido(s) não reconhecido(s):</strong>{" "}
                {unrecognized.join(", ")}. Revise o texto colado.
              </div>
            )}

            {result.consolidated && <ConsolidatedSheet sections={result.consolidated} />}

            {result.days.length > 0 && (
              <>
                <h2 className="text-base font-bold uppercase tracking-widest text-muted-foreground mt-6 mb-3">
                  Detalhamento Diário
                </h2>
                <DaysGrid>
                  {result.days.map((d, i) => (
                    <DayBlock key={i} day={d} />
                  ))}
                </DaysGrid>
              </>
            )}
          </div>
        )}
      </main>

      <Dialog open={priorityOpen} onOpenChange={setPriorityOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>🔥 Ordem de prioridade — Corte</DialogTitle>
            <DialogDescription>
              Pedidos na ordem natural de envio (mais urgentes primeiro). Medalhas e
              chaveiros foram omitidos — já estão em estoque cortado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const txt = formatPriorityAsText(priorityItems);
                const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `prioridade-${new Date().toISOString().slice(0, 10)}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              📄 Baixar .txt
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(formatPriorityAsText(priorityItems));
              }}
            >
              📋 Copiar
            </Button>
          </div>
          <div className="overflow-auto border rounded-md">
            <ol className="divide-y">
              {(() => {
                const rows: React.ReactNode[] = [];
                let lastOrder = "";
                let idx = 0;
                priorityItems.forEach((it, i) => {
                  if (it.orderId !== lastOrder) {
                    idx++;
                    lastOrder = it.orderId;
                    rows.push(
                      <li key={`h-${i}`} className="bg-muted/60 px-3 py-2 flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          #{idx} · Pedido {it.orderId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Envio até {it.date}
                          {it.urgencyLabel && (
                            <span className="ml-2 inline-block px-2 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
                              ⚡ {it.urgencyLabel}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  }
                  rows.push(
                    <li key={`i-${i}`} className="px-5 py-1.5 text-sm flex items-center gap-2">
                      <span className="font-mono font-semibold w-10 text-right">{it.qty}x</span>
                      <span className="flex-1">
                        <span className="font-medium">{it.group}</span>
                        <span className="text-muted-foreground"> — {it.sizeOrItem}</span>
                      </span>
                    </li>
                  );
                });
                if (!rows.length) {
                  rows.push(
                    <li key="empty" className="p-4 text-sm text-muted-foreground text-center">
                      Nenhum item de prioridade (apenas medalhas/chaveiros nos pedidos).
                    </li>
                  );
                }
                return rows;
              })()}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
