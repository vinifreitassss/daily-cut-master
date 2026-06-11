import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { buildConsolidated, type ParseResult } from "@/lib/parseOrders";
import {
  parseShopeeOrders,
  extractShopeeOrdersList,
  formatOrdersAsText,
  extractPriorityList,
  formatPriorityAsText,
  extractPriorityOrderSheets,
  extractPrintList,
  type PriorityItem,
  type PriorityOrderSheet,
  type PrintDay,
  type OrderSummary,
} from "@/lib/parseShopeeOrders";
import { PrintSheet } from "@/components/PrintSheet";
import { NfList } from "@/components/NfList";
import { OrderPhotoList } from "@/components/OrderPhotoList";
import {
  ConsolidatedSheet,
  DayBlock,
  DaysGrid,
  PriorityOrderBlock,
  PriorityGrid,
} from "@/components/OrderSheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
          "Cole sua lista de pedidos da Shopee e gere ordem de corte, impressão e NFs.",
      },
    ],
  }),
});

const EXAMPLE_RAW = `raianeevelinromisdosreis
ID do Pedido 260424NHMG4NNH
Sob encomenda
Kit Medalhas Personalizadas de acrílico de 5 cm Adesivadas com Fita Diversas Quantidades
Variação: 5 cm com fita,30
x2
R$139,25
Por favor, envie o pedido antes de 06/05/2026 para evitar o cancelamento automático.`;

function Index() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [nfOpen, setNfOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [viewByPriority, setViewByPriority] = useState(false);

  const priorityItems = useMemo<PriorityItem[]>(
    () => (submitted ? extractPriorityList(submitted) : []),
    [submitted]
  );

  const prioritySheets = useMemo<PriorityOrderSheet[]>(
    () => (submitted ? extractPriorityOrderSheets(submitted) : []),
    [submitted]
  );

  const printDays = useMemo<PrintDay[]>(
    () => (submitted ? extractPrintList(submitted) : []),
    [submitted]
  );

  const ordersList = useMemo<OrderSummary[]>(
    () => (submitted ? extractShopeeOrdersList(submitted) : []),
    [submitted]
  );

  const orderIds = useMemo(() => ordersList.map((o) => o.orderId), [ordersList]);

  const { result, unrecognized } = useMemo<{
    result: ParseResult | null;
    unrecognized: string[];
  }>(() => {
    if (!submitted) return { result: null, unrecognized: [] };
    const r = parseShopeeOrders(submitted);
    return {
      result: { days: r.days, consolidated: buildConsolidated(r.days) },
      unrecognized: r.unrecognized,
    };
  }, [submitted]);

  const handleGenerate = () => setSubmitted(text);
  const handleClear = () => {
    setText("");
    setSubmitted(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-foreground/15 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">📋 Ordem de Corte</h1>
            <p className="text-xs text-muted-foreground">Cole os pedidos brutos da Shopee, gere e imprima</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleClear}>
              Limpar
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={!text.trim()}>
              Gerar
            </Button>
            <Button size="sm" variant="default" onClick={() => window.print()} disabled={!result}>
              🖨 Imprimir corte
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const txt = formatOrdersAsText(ordersList);
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
              disabled={!result}
            >
              📄 Lista pedidos (.txt)
            </Button>
            <Button
              size="sm"
              variant={viewByPriority ? "default" : "secondary"}
              onClick={() => setViewByPriority((v) => !v)}
              disabled={!result || prioritySheets.length === 0}
            >
              {viewByPriority ? "📅 Ver por data" : "🔥 Corte por prioridade"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPriorityOpen(true)}
              disabled={!result || priorityItems.length === 0}
            >
              📝 Resumo prioridade
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPrintOpen(true)}
              disabled={!result || printDays.length === 0}
            >
              🖨️ Lista de impressão
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setNfOpen(true)}
              disabled={!result || orderIds.length === 0}
            >
              🧾 Lista NFs
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPhotoOpen(true)}
              disabled={!result || ordersList.length === 0}
            >
              📷 Pedidos c/ fotos
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!result && (
          <section className="no-print">
            <p className="text-xs text-muted-foreground mb-2">
              Cole o texto cru direto da Shopee. O app extrai data, produto, variação e
              quantidade automaticamente.
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE_RAW}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={!text.trim()}>
                Gerar Ordem de Corte
              </Button>
              <button
                type="button"
                className="text-xs underline text-muted-foreground"
                onClick={() => setText(EXAMPLE_RAW)}
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
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {viewByPriority ? "Ordem de Corte — Por Prioridade" : "Ordem de Corte"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gerado em {new Date().toLocaleDateString("pt-BR")} —{" "}
                  {viewByPriority
                    ? `${prioritySheets.length} pedido(s) — mais urgentes primeiro`
                    : `${result.days.length} dia(s)`}
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

            {viewByPriority ? (
              <>
                <div className="no-print mb-3 rounded-md border border-foreground/20 bg-muted/40 p-3 text-xs text-muted-foreground">
                  Pedidos na ordem natural de envio da Shopee (mais urgentes no topo).
                  Medalhas e chaveiros estão omitidos — já estão em estoque cortado.
                </div>
                <PriorityGrid>
                  {prioritySheets.map((o, i) => (
                    <PriorityOrderBlock key={o.orderId + i} order={o} idx={i + 1} />
                  ))}
                </PriorityGrid>
              </>
            ) : (
              <>
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

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>🖨️ Lista de Impressão — Personalizados</DialogTitle>
            <DialogDescription>
              Itens personalizados agrupados por data de envio. Marque cada item após
              imprimir — o progresso fica salvo neste navegador.
            </DialogDescription>
          </DialogHeader>
          <PrintSheet days={printDays} />
        </DialogContent>
      </Dialog>

      <Dialog open={nfOpen} onOpenChange={setNfOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>🧾 Lista de pedidos — Emissão de NF</DialogTitle>
            <DialogDescription>
              Apenas os códigos dos pedidos, um por linha — pronto para gerar as notas fiscais.
            </DialogDescription>
          </DialogHeader>
          <NfList orderIds={orderIds} />
        </DialogContent>
      </Dialog>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>📷 Pedidos com fotos e código de barras</DialogTitle>
            <DialogDescription>
              Cada pedido mostra produto, quantidade, foto do produto e código de barras.
              Anexe uma imagem por pedido (arte de personalização) — fica salva neste navegador.
            </DialogDescription>
          </DialogHeader>
          <OrderPhotoList orders={ordersList} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
