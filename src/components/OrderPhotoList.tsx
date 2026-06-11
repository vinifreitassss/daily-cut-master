import { useRef } from "react";
import type { OrderSummary } from "@/lib/parseShopeeOrders";
import { Button } from "@/components/ui/button";
import { Barcode } from "@/components/Barcode";
import { getTrofeuImage } from "@/lib/trofeuImages";
import { useOrderAttachments, fileToCompressedDataUrl } from "@/lib/orderAttachments";

type Props = {
  orders: OrderSummary[];
};

function productImageFor(product: string, variation: string): string | null {
  // tenta pela variação (TFA117 etc.)
  const v = getTrofeuImage(variation);
  if (v) return v;
  // tenta achar uma sigla no nome do produto
  const m = product.match(/TF?A\s*\d{3}/i);
  if (m) {
    const k = getTrofeuImage(m[0].replace(/\s+/g, ""));
    if (k) return k;
  }
  if (/ta[çc]a/i.test(product)) return getTrofeuImage("TACA MDF");
  if (/kit\s+12\s+trof/i.test(product)) return getTrofeuImage("KIT 12 TROFEUS DECORATIVOS");
  return null;
}

export function OrderPhotoList({ orders }: Props) {
  const { get, set, remove } = useOrderAttachments();

  const doPrint = () => {
    document.body.classList.add("print-photo-mode");
    const cleanup = () => {
      document.body.classList.remove("print-photo-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  if (!orders.length) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Nenhum pedido encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sm mr-2">{orders.length} pedido(s)</span>
        <Button size="sm" variant="secondary" onClick={doPrint}>🖨️ Imprimir folha</Button>
        <span className="text-muted-foreground">
          Anexos ficam salvos neste navegador.
        </span>
      </div>

      <div className="no-print overflow-auto border rounded-md max-h-[65vh] divide-y">
        {orders.map((o) => (
          <OrderRow
            key={o.orderId}
            order={o}
            attachment={get(o.orderId)}
            onAttach={(file) => fileToCompressedDataUrl(file).then((url) => set(o.orderId, url))}
            onRemove={() => remove(o.orderId)}
          />
        ))}
      </div>

      {/* Versão imprimível */}
      <PrintableOrderPhotos orders={orders} getAttachment={get} />
    </div>
  );
}

function OrderRow({
  order,
  attachment,
  onAttach,
  onRemove,
}: {
  order: OrderSummary;
  attachment: string | null;
  onAttach: (f: File) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">
          Pedido {order.orderId}{" "}
          <span className="text-muted-foreground font-normal">· envio até {order.date}</span>
        </div>
        <div className="bg-white rounded p-1">
          <Barcode value={order.orderId} height={36} fontSize={10} />
        </div>
      </div>
      <ul className="space-y-2">
        {order.items.map((it, i) => {
          const img = productImageFor(it.product, it.variation);
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              {img ? (
                <img src={img} alt={it.product} className="w-14 h-14 object-contain border rounded bg-white flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 border rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
                  sem foto
                </div>
              )}
              <div className="flex-1">
                <span className="font-mono font-semibold">{it.qty}x </span>
                <span>{it.product}</span>
                {it.variation && (
                  <span className="text-muted-foreground"> — {it.variation}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 pt-1 border-t">
        {attachment ? (
          <>
            <img src={attachment} alt="anexo" className="w-16 h-16 object-cover border rounded" />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Trocar anexo
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              Remover
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            📎 Anexar imagem da personalização
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAttach(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function PrintableOrderPhotos({
  orders,
  getAttachment,
}: {
  orders: OrderSummary[];
  getAttachment: (orderId: string) => string | null;
}) {
  return (
    <div className="print-photo-only" aria-hidden="true">
      <h1 style={{ fontSize: "13pt", fontWeight: 800, marginBottom: 8 }}>
        Pedidos — produto, quantidade e código
      </h1>
      {orders.map((o) => {
        const att = getAttachment(o.orderId);
        return (
          <div
            key={o.orderId}
            style={{
              border: "1px solid #000",
              borderRadius: 4,
              padding: 8,
              marginBottom: 8,
              pageBreakInside: "avoid",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: "10pt", fontWeight: 700 }}>
                Pedido {o.orderId} — envio até {o.date}
              </div>
              <div style={{ background: "#fff" }}>
                <Barcode value={o.orderId} height={40} width={1.4} fontSize={10} />
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
              <tbody>
                {o.items.map((it, i) => {
                  const img = productImageFor(it.product, it.variation);
                  return (
                    <tr key={i}>
                      <td style={{ width: 60, padding: 2, verticalAlign: "top" }}>
                        {img ? (
                          <img src={img} alt="" style={{ width: 56, height: 56, objectFit: "contain", border: "1px solid #ccc" }} />
                        ) : (
                          <div style={{ width: 56, height: 56, border: "1px dashed #999" }} />
                        )}
                      </td>
                      <td style={{ width: 60, padding: 2, verticalAlign: "top" }}>
                        {att && i === 0 ? (
                          <img src={att} alt="" style={{ width: 56, height: 56, objectFit: "cover", border: "1px solid #000" }} />
                        ) : i === 0 ? (
                          <div style={{ width: 56, height: 56, border: "1px dashed #999" }} />
                        ) : null}
                      </td>
                      <td style={{ padding: 2, verticalAlign: "top" }}>
                        <strong>{it.qty}x</strong> {it.product}
                        {it.variation ? ` — ${it.variation}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
