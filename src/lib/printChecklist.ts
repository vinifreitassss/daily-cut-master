import { useCallback, useEffect, useRef, useState } from "react";

export type PrintItemMeta = {
  product: string;
  variation: string;
  qty: number;
  date: string;
};

export type PrintChecklistEntry = PrintItemMeta & {
  done: boolean;
  doneAt: string | null;
  firstSeenAt: string;
};

// { [orderId]: { [itemKey]: entry } }
export type PrintChecklistState = Record<string, Record<string, PrintChecklistEntry>>;

const STORAGE_KEY = "print-checklist-v1";

function loadFromStorage(): PrintChecklistState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PrintChecklistState;
  } catch {
    return {};
  }
}

export function usePrintChecklist() {
  const [state, setState] = useState<PrintChecklistState>({});
  const initRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(loadFromStorage());
    initRef.current = true;
  }, []);

  useEffect(() => {
    if (!initRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore quota errors
      }
    }, 150);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const isDone = useCallback(
    (orderId: string, key: string) => !!state[orderId]?.[key]?.done,
    [state]
  );

  const getEntry = useCallback(
    (orderId: string, key: string) => state[orderId]?.[key],
    [state]
  );

  const ensureSeen = useCallback((orderId: string, key: string, meta: PrintItemMeta) => {
    setState((prev) => {
      if (prev[orderId]?.[key]) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [key]: { ...meta, done: false, doneAt: null, firstSeenAt: now },
        },
      };
    });
  }, []);

  const toggle = useCallback((orderId: string, key: string, meta: PrintItemMeta) => {
    setState((prev) => {
      const existing = prev[orderId]?.[key];
      const now = new Date().toISOString();
      const next: PrintChecklistEntry = existing
        ? {
            ...existing,
            ...meta, // refresh meta in case product/variation text drifted
            done: !existing.done,
            doneAt: !existing.done ? now : null,
          }
        : { ...meta, done: true, doneAt: now, firstSeenAt: now };
      return {
        ...prev,
        [orderId]: { ...(prev[orderId] || {}), [key]: next },
      };
    });
  }, []);

  const clearOrders = useCallback((orderIds: string[]) => {
    setState((prev) => {
      const next = { ...prev };
      for (const id of orderIds) delete next[id];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setState({}), []);

  return { state, isDone, getEntry, ensureSeen, toggle, clearOrders, clearAll };
}
