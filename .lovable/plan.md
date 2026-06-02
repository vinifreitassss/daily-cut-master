
## Lista de Impressão (personalizados) — por dia, com checklist persistente

Nova visão paralela à lista de corte. Filtra apenas itens **personalizados** (título contém "personalizado/personalizada"), agrupa por **data de envio**, e permite marcar cada item como impresso. Status fica salvo no `localStorage` do navegador e acumula histórico entre listas coladas. Botão para imprimir folha que vai para o design.

Compartilhamento via servidor próprio do PC fica de fora — exigiria backend rodando localmente, fora do escopo do app web. A versão impressa cobre esse fluxo.

### O que muda

**1. Parser (`src/lib/parseShopeeOrders.ts`)**
- Nova função `extractPrintList(input)` que percorre os blocos Shopee e devolve `PrintDay[]` com:
  - `date` (DD/MM/AAAA da data de postar)
  - `orders: { orderId, items: { product, variation, qty }[] }[]`
- Filtro: só inclui itens cujo `product` casa `/personalizad[oa]/i` (cobre troféus personalizados, medalhas personalizadas, kits personalizados, chaveiros personalizados).
- Ordena dias por data crescente; dentro do dia mantém a ordem natural da Shopee (prioridade de envio).
- Cada item carrega uma `key` estável (`orderId::idx`) para o checklist.

**2. Estado do checklist (`src/lib/printChecklist.ts`, novo)**
- Hook `usePrintChecklist()` que:
  - Lê/grava em `localStorage` na chave `print-checklist-v1`.
  - Formato: `{ [orderId]: { [itemKey]: { done: boolean, doneAt: string, product: string, variation: string, qty: number, date: string } } }`.
  - API: `isDone(orderId, key)`, `toggle(orderId, key, itemMeta)`, `clearOrder(orderId)`, `clearAll()`, `getHistory()`.
- Histórico acumulado: pedidos antigos permanecem no storage mesmo que saiam da lista colada atual.

**3. UI (`src/routes/index.tsx` + novo `src/components/PrintSheet.tsx`)**
- Botão **🖨️ Lista de impressão** (disponível no modo Shopee bruto, ao lado de "Corte por prioridade").
- Abre um `Dialog` com:
  - Toggle "Pendentes apenas" / "Mostrar tudo".
  - Toggle "Incluir histórico de pedidos antigos".
  - Para cada dia: cabeçalho com data + contador "X de Y impressos"; lista de pedidos com checkbox por item (qty + produto + variação).
  - Item marcado: linha riscada + horário de baixa.
  - Botões: **🖨️ Imprimir folha** (usa `window.print()` com CSS print-only) e **Limpar marcações deste lote**.
- Versão impressa: layout simples preto-no-branco, agrupado por dia, com checkbox vazio ao lado de cada item para o design marcar a caneta. Cabeçalho com data de geração.

### Detalhes técnicos

- **Triagem**: regex `/personalizad[oa]/i` no `raw.product` antes da classificação. Itens já existentes (medalhas personalizadas, troféus personalizados, kits personalizados) caem naturalmente — o parser de classificação existente continua intocado.
- **Quantidade exibida**: usamos o `multiplier` × kit (ex: kit medalhas 30 → "30 un de medalha 5cm personalizada"). Para troféus em kit, expandimos por tamanho como já fazemos no corte.
- **Persistência**: `localStorage` carregado em `useEffect` com fallback vazio; gravação debounced (~150ms) para não bater a cada clique.
- **Print CSS**: classe `print-only` no `src/styles.css` + `@media print { body * { visibility: hidden } .print-area, .print-area * { visibility: visible } }`.
- **Sem mudanças no backend** — tudo client-side.

### Fora de escopo (proposto, não incluído)

- Link compartilhável com sincronização entre dispositivos (precisaria habilitar Lovable Cloud). Posso adicionar depois se quiser deixar o design marcar pelo celular dele.
- Servidor local no PC do usuário: não é viável a partir do app web; exigiria instalar um servidor à parte.
