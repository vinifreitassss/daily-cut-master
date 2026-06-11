import { useMemo, useState } from "react";
import { Barcode } from "./components/Barcode";
import {
  buildConsolidated,
  type Section,
  type DaySheet,
} from "./lib/parseOrders";
import {
  extractPrintList,
  extractPriorityOrderSheets,
  extractShopeeOrdersList,
  formatOrdersAsText,
  parseShopeeOrders,
  type OrderSummary,
  type PrintDay,
  type PriorityOrderSheet,
} from "./lib/parseShopeeOrders";
import { getTrofeuImage } from "./lib/trofeuImages";

type Tab = "corte" | "prioridade" | "impressao" | "nf" | "pedidos" | "fotos";
type OrderAttachments = Record<string, string>;

const EXAMPLE_RAW = `raianeevelinromisdosreis
ID do Pedido 260424NHMG4NNH
Sob encomenda
Kit Medalhas Personalizadas de acrílico de 5 cm Adesivadas com Fita Diversas Quantidades
Variação: 5 cm com fita,30
x2
R$139,25
Por favor, envie o pedido antes de 06/05/2026 para evitar o cancelamento automático.`;

function downloadTxt(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}

function printPage(tab: Tab) {
  document.body.dataset.printMode = tab;
  const cleanup = () => {
    delete document.body.dataset.printMode;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  setTimeout(cleanup, 1200);
}

function canUseAutomaticProductImage(product: string, variation: string): boolean {
  const text = `${product} ${variation}`.toLowerCase();
  if (/hand\s*grip|mini\s*painel|painel|placa|ripa|chaveir|medalh/.test(text)) return false;
  return /trof[eé]u|trof[eé]us|ta[çc]a|kit\s*12\s*trof/.test(text);
}

function productImageFor(product: string, variation: string): string | null {
  if (!canUseAutomaticProductImage(product, variation)) return null;

  if (/ta[çc]a/i.test(product) || /ta[çc]a/i.test(variation)) return getTrofeuImage("TACA MDF");
  if (/kit\s*12\s*trof/i.test(product)) return getTrofeuImage("KIT 12 TROFEUS DECORATIVOS");

  const byVariation = getTrofeuImage(variation);
  if (byVariation) return byVariation;

  const modelMatch = `${variation} ${product}`.match(/TFA\s*\d{3}|TA\s*\d{3}|TFA\d{3}|TA\d{3}/i);
  if (modelMatch) {
    const img = getTrofeuImage(modelMatch[0].replace(/\s+/g, ""));
    if (img) return img;
  }

  return null;
}

export default function App() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [tab, setTab] = useState<Tab>("corte");
  const [orderAttachments, setOrderAttachments] = useState<OrderAttachments>({});

  const parsed = useMemo(() => {
    if (!submitted.trim()) {
      return {
        days: [] as DaySheet[],
        consolidated: null as Section[] | null,
        unrecognized: [] as string[],
        prioritySheets: [] as PriorityOrderSheet[],
        printDays: [] as PrintDay[],
        orders: [] as OrderSummary[],
      };
    }

    const r = parseShopeeOrders(submitted);
    const days = r.days;
    return {
      days,
      consolidated: buildConsolidated(days),
      unrecognized: r.unrecognized,
      prioritySheets: extractPriorityOrderSheets(submitted),
      printDays: extractPrintList(submitted),
      orders: extractShopeeOrdersList(submitted),
    };
  }, [submitted]);

  const hasResult = parsed.days.length > 0 || parsed.orders.length > 0;
  const orderIds = parsed.orders.map((o) => o.orderId);
  const nfText = orderIds.join("\n");
  const pedidosText = formatOrdersAsText(parsed.orders);

  const generate = () => {
    setSubmitted(text);
    setTab("corte");
  };

  const clear = () => {
    setText("");
    setSubmitted("");
    setTab("corte");
    setOrderAttachments({});
  };

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div>
          <h1>📋 Daily Cut Local</h1>
          <p>Versão local simples: cola, gera e imprime. Não salva nada.</p>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={() => setText(EXAMPLE_RAW)}>Exemplo</button>
          <button className="btn ghost" onClick={clear}>Limpar</button>
          <button className="btn primary" onClick={generate} disabled={!text.trim()}>Gerar</button>
          <button className="btn" onClick={() => printPage(tab)} disabled={!hasResult}>🖨 Imprimir tela</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel input-panel no-print">
          <div className="panel-title">
            <h2>Texto bruto da Shopee</h2>
            <span>{text.length.toLocaleString("pt-BR")} caracteres</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o texto copiado da Shopee..."
          />
          <div className="hint">
            O app roda só na memória da tela. Fechou ou atualizou, perde o lote atual.
          </div>
        </section>

        <section className="panel result-panel">
          {!hasResult ? (
            <EmptyState />
          ) : (
            <>
              <div className="result-head no-print">
                <div>
                  <h2>Resultado</h2>
                  <p>
                    {parsed.orders.length} pedido(s) · {parsed.days.length} data(s)
                    {parsed.unrecognized.length ? ` · ${parsed.unrecognized.length} não reconhecido(s)` : ""}
                  </p>
                </div>
                <div className="tabs">
                  <TabButton active={tab === "corte"} onClick={() => setTab("corte")}>Corte</TabButton>
                  <TabButton active={tab === "prioridade"} onClick={() => setTab("prioridade")}>Prioridade</TabButton>
                  <TabButton active={tab === "impressao"} onClick={() => setTab("impressao")}>Impressão</TabButton>
                  <TabButton active={tab === "nf"} onClick={() => setTab("nf")}>NFs</TabButton>
                  <TabButton active={tab === "pedidos"} onClick={() => setTab("pedidos")}>Pedidos</TabButton>
                  <TabButton active={tab === "fotos"} onClick={() => setTab("fotos")}>Fotos/Códigos</TabButton>
                </div>
              </div>

              {parsed.unrecognized.length > 0 && (
                <div className="alert no-print">
                  ⚠️ Pedidos não reconhecidos: {parsed.unrecognized.join(", ")}
                </div>
              )}

              <div className="print-header only-print">
                <h1>{printTitle(tab)}</h1>
                <p>Gerado em {new Date().toLocaleString("pt-BR")} — Silva Campos Esportes</p>
              </div>

              {tab === "corte" && <CutView days={parsed.days} consolidated={parsed.consolidated} />}
              {tab === "prioridade" && <PriorityView sheets={parsed.prioritySheets} />}
              {tab === "impressao" && <PrintView days={parsed.printDays} />}
              {tab === "nf" && (
                <TextView
                  title="Lista de pedidos para NF"
                  text={nfText}
                  filename={`nf-pedidos-${new Date().toISOString().slice(0, 10)}.txt`}
                />
              )}
              {tab === "pedidos" && (
                <TextView
                  title="Lista completa de pedidos"
                  text={pedidosText}
                  filename={`pedidos-${new Date().toISOString().slice(0, 10)}.txt`}
                />
              )}
              {tab === "fotos" && (
                <PhotoBarcodeView
                  orders={parsed.orders}
                  attachments={orderAttachments}
                  setAttachments={setOrderAttachments}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function printTitle(tab: Tab) {
  const titles: Record<Tab, string> = {
    corte: "Ordem de Corte",
    prioridade: "Corte por Prioridade",
    impressao: "Lista de Impressão",
    nf: "Lista de NFs",
    pedidos: "Lista de Pedidos",
    fotos: "Fotos dos Produtos e Códigos de Barras",
  };
  return titles[tab];
}

function EmptyState() {
  return (
    <div className="empty no-print">
      <h2>Nenhum lote gerado ainda</h2>
      <p>Cole os pedidos da Shopee à esquerda e clique em Gerar.</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "tab active" : "tab"} onClick={onClick}>{children}</button>;
}

function CutView({ days, consolidated }: { days: DaySheet[]; consolidated: Section[] | null }) {
  return (
    <div className="content printable-area">
      {consolidated && consolidated.length > 0 && (
        <section className="sheet-block consolidated">
          <h2>📊 Consolidado geral</h2>
          <Sections sections={consolidated} />
        </section>
      )}

      {days.map((day) => (
        <section className="sheet-block" key={day.date}>
          <h2>📅 Postar até {day.date}</h2>
          <Sections sections={day.sections} />
        </section>
      ))}
    </div>
  );
}

function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="sections-grid">
      {sections.map((sec) => (
        <div className="section-card" key={sec.key + sec.title}>
          <h3>{sec.emoji} {sec.title}</h3>
          {sec.groups.map((group, idx) => (
            <div className="group" key={group.variation + idx}>
              {group.variation && <h4>{group.variation}</h4>}
              <ul>
                {group.items.map((item) => (
                  <li key={item.name + item.unit}>
                    <span>{item.name}</span>
                    <strong>{item.qty}{item.unit ? ` ${item.unit}` : ""}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PriorityView({ sheets }: { sheets: PriorityOrderSheet[] }) {
  if (!sheets.length) return <div className="empty"><h2>Nenhum item de prioridade.</h2><p>Provavelmente o lote só tem medalhas/chaveiros.</p></div>;
  return (
    <div className="content printable-area priority-list">
      {sheets.map((order, idx) => (
        <section className="sheet-block compact" key={order.orderId + idx}>
          <h2>#{idx + 1} · Pedido {order.orderId} · Envio até {order.date}</h2>
          {order.urgencyLabel && <p className="urgent">⚡ {order.urgencyLabel}</p>}
          <Sections sections={order.sections} />
        </section>
      ))}
    </div>
  );
}

function PrintView({ days }: { days: PrintDay[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const total = days.reduce((sum, day) => sum + day.orders.reduce((s, o) => s + o.items.length, 0), 0);
  const done = Object.values(checked).filter(Boolean).length;

  if (!days.length) return <div className="empty"><h2>Nenhum item personalizado encontrado.</h2></div>;

  return (
    <div className="content printable-area">
      <div className="toolbar no-print">
        <strong>{done}/{total} marcados nesta tela</strong>
        <span>As marcações são temporárias e somem ao atualizar.</span>
      </div>
      {days.map((day) => (
        <section className="sheet-block compact" key={day.date}>
          <h2>📅 Postar até {day.date}</h2>
          {day.orders.map((order) => (
            <div className="print-order" key={order.orderId}>
              <h3>Pedido {order.orderId}{order.urgencyLabel ? ` · ⚡ ${order.urgencyLabel}` : ""}</h3>
              <ul className="check-list">
                {order.items.map((item) => (
                  <li key={item.key} className={checked[item.key] ? "done" : ""}>
                    <label>
                      <input
                        type="checkbox"
                        className="no-print"
                        checked={!!checked[item.key]}
                        onChange={() => setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      />
                      <span className="print-box only-print" />
                      <strong>{item.qty}x</strong> {item.product}{item.variation ? ` — ${item.variation}` : ""}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function PhotoBarcodeView({
  orders,
  attachments,
  setAttachments,
}: {
  orders: OrderSummary[];
  attachments: OrderAttachments;
  setAttachments: React.Dispatch<React.SetStateAction<OrderAttachments>>;
}) {
  if (!orders.length) return <div className="empty"><h2>Nenhum pedido encontrado.</h2></div>;

  const attachImage = async (orderId: string, file: File | null | undefined) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setAttachments((prev) => ({ ...prev, [orderId]: dataUrl }));
  };

  const removeImage = (orderId: string) => {
    setAttachments((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  return (
    <div className="content printable-area photo-view">
      <div className="toolbar no-print">
        <strong>{orders.length} pedido(s)</strong>
        <span>Foto automática só para troféus/taças. A imagem anexada é por pedido e temporária.</span>
      </div>

      <div className="photo-grid">
        {orders.map((order) => {
          const attached = attachments[order.orderId];
          return (
            <section className="photo-card" key={order.orderId}>
              <div className="photo-card-head">
                <div>
                  <h2>Pedido {order.orderId}</h2>
                  <p>Envio até {order.date}</p>
                </div>
                <div className="barcode-box">
                  <Barcode value={order.orderId} height={42} width={1.35} fontSize={10} />
                </div>
              </div>

              <div className="attached-photo-block">
                <div className="attached-photo">
                  {attached ? <img src={attached} alt={`Imagem do pedido ${order.orderId}`} /> : <span>imagem do pedido</span>}
                </div>
                <div className="attached-actions no-print">
                  <label className="btn small-file-btn">
                    {attached ? "Trocar imagem" : "Anexar imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        attachImage(order.orderId, e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {attached && <button className="btn ghost" onClick={() => removeImage(order.orderId)}>Remover</button>}
                </div>
              </div>

              <ul className="photo-items">
                {order.items.map((item, idx) => {
                  const img = productImageFor(item.product, item.variation);
                  return (
                    <li key={`${order.orderId}-${idx}`}>
                      {img ? (
                        <img src={img} alt={item.product} />
                      ) : (
                        <div className="missing-img">sem foto</div>
                      )}
                      <div>
                        <strong>{item.qty}x</strong> {item.product}
                        {item.variation && <span> — {item.variation}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TextView({ title, text, filename }: { title: string; text: string; filename: string }) {
  return (
    <div className="content printable-area text-view">
      <div className="toolbar no-print">
        <button className="btn" onClick={() => copyText(text)}>📋 Copiar</button>
        <button className="btn" onClick={() => downloadTxt(filename, text)}>📄 Baixar TXT</button>
      </div>
      <section className="sheet-block">
        <h2>{title}</h2>
        <pre>{text || "Nenhum pedido encontrado."}</pre>
      </section>
    </div>
  );
}
