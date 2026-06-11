import { Button } from "@/components/ui/button";

type Props = {
  orderIds: string[];
};

export function NfList({ orderIds }: Props) {
  const doPrint = () => {
    document.body.classList.add("print-nf-mode");
    const cleanup = () => {
      document.body.classList.remove("print-nf-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(orderIds.join("\n"));
  };

  const downloadTxt = () => {
    const blob = new Blob([orderIds.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nf-pedidos-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!orderIds.length) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Nenhum pedido encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="no-print flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-sm mr-2">{orderIds.length} pedido(s)</span>
        <Button size="sm" variant="secondary" onClick={doPrint}>🖨️ Imprimir</Button>
        <Button size="sm" variant="outline" onClick={copyToClipboard}>📋 Copiar</Button>
        <Button size="sm" variant="outline" onClick={downloadTxt}>📄 Baixar .txt</Button>
      </div>

      <div className="no-print overflow-auto border rounded-md max-h-[60vh] p-3">
        <pre className="font-mono text-sm whitespace-pre">{orderIds.join("\n")}</pre>
      </div>

      {/* Versão imprimível */}
      <div className="print-nf-only" aria-hidden="true">
        <h1 style={{ fontSize: "14pt", fontWeight: 800, marginBottom: 4 }}>
          Lista de pedidos para emissão de NF
        </h1>
        <p style={{ fontSize: "9pt", marginBottom: 12, color: "#555" }}>
          Gerado em {new Date().toLocaleString("pt-BR")} — {orderIds.length} pedido(s)
        </p>
        <pre style={{ fontFamily: "monospace", fontSize: "11pt", lineHeight: 1.5, margin: 0 }}>
          {orderIds.join("\n")}
        </pre>
      </div>
    </div>
  );
}
