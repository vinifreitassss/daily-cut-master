import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "order-attachments-v1";

export type AttachmentsState = Record<string, string>; // orderId -> dataUrl

function load(): AttachmentsState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttachmentsState) : {};
  } catch {
    return {};
  }
}

export function useOrderAttachments() {
  const [state, setState] = useState<AttachmentsState>({});
  const init = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(load());
    init.current = true;
  }, []);

  useEffect(() => {
    if (!init.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // quota — ignore silently
      }
    }, 150);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  const set = useCallback((orderId: string, dataUrl: string) => {
    setState((prev) => ({ ...prev, [orderId]: dataUrl }));
  }, []);

  const remove = useCallback((orderId: string) => {
    setState((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

  const get = useCallback((orderId: string) => state[orderId] || null, [state]);

  return { state, set, remove, get };
}

/** Reads a File as compressed JPEG data URL (max 800px) to keep localStorage small. */
export function fileToCompressedDataUrl(file: File, maxDim = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao ler imagem"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
