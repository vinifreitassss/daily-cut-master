import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { parseOrders } from "@/lib/parseOrders";
import { ConsolidatedSheet, DayBlock, DaysGrid } from "@/components/OrderSheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Ordem de Corte — Silva Campos Esportes" },
      { name: "description", content: "Cole sua lista de pedidos e gere uma ordem de corte organizada para impressão." },
    ],
  }),
});

const EXAMPLE = `📅 06/05/2026

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

function Index() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  const result = useMemo(() => (submitted ? parseOrders(submitted) : null), [submitted]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="no-print border-b border-foreground/15 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">📋 Ordem de Corte</h1>
            <p className="text-xs text-muted-foreground">Cole a lista, gere e imprima</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setText("");
                setSubmitted("");
              }}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              onClick={() => setSubmitted(text)}
              disabled={!text.trim()}
            >
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
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!result && (
          <section className="no-print">
            <label className="block text-sm font-semibold mb-2">
              Cole aqui a lista de pedidos
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={() => setSubmitted(text)} disabled={!text.trim()}>
                Gerar Ordem de Corte
              </Button>
              <button
                type="button"
                className="text-xs underline text-muted-foreground"
                onClick={() => setText(EXAMPLE)}
              >
                Carregar exemplo
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Formato esperado: <code>📅 data</code>, depois <code>🏆 Troféus</code>,{" "}
              <code>🏅 Medalhas</code>, <code>🧱 MDF extra</code>, e por fim{" "}
              <code>📊 CONSOLIDADO FINAL</code>. Itens no formato <code>tamanho → qtd</code>.
            </p>
          </section>
        )}

        {result && (
          <div className="print-area">
            <div className="mb-4 flex items-end justify-between border-b-2 border-foreground pb-3">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Ordem de Corte</h1>
                <p className="text-xs text-muted-foreground">
                  Gerado em {new Date().toLocaleDateString("pt-BR")} —{" "}
                  {result.days.length} dia(s)
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Silva Campos Esportes</div>
              </div>
            </div>

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
    </div>
  );
}
