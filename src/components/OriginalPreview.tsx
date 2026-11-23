"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ExternalLink, Minus, Plus, X } from "lucide-react";

type Preview = { kind: "pdf"; pdf: PDFDocumentProxy } | { kind: "image"; url: string };

export function OriginalPreview({ url, close, missing }: {
  url: string; close(): void; missing(): void;
}) {
  const [document, setDocument] = useState<Preview>();
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    closeRef.current?.focus();
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    async function load() {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (response.status === 404) { missing(); return; }
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (blob.type === "application/pdf") {
        const library = await import("pdfjs-dist");
        library.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const data = await blob.arrayBuffer();
        if (controller.signal.aborted) return;
        task = library.getDocument({ data, isEvalSupported: false, useSystemFonts: true });
        const pdf = await task.promise;
        if (!controller.signal.aborted) setDocument({ kind: "pdf", pdf });
      } else {
        objectUrl = URL.createObjectURL(blob);
        setDocument({ kind: "image", url: objectUrl });
      }
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (task) void task.destroy();
    };
  }, [url, missing]);
  useEffect(() => {
    const node = canvas.current;
    if (document?.kind !== "pdf" || !node || !width) return;
    let cancelled = false;
    let render: import("pdfjs-dist").RenderTask | undefined;
    async function paint(pdf: PDFDocumentProxy, target: HTMLCanvasElement) {
      const sheet = await pdf.getPage(page);
      if (cancelled) return;
      const scale = Math.min(width - 24, 800) * zoom / 100 / sheet.getViewport({ scale: 1 }).width;
      const ratio = Math.min(window.devicePixelRatio, 2);
      const viewport = sheet.getViewport({ scale: scale * ratio });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      target.style.width = `${viewport.width / ratio}px`;
      const context = target.getContext("2d");
      if (!context) throw new Error();
      render = sheet.render({ viewport, canvasContext: context });
      await render.promise;
    }
    paint(document.pdf, node).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; render?.cancel(); };
  }, [document, page, zoom, width]);
  const total = document?.kind === "pdf" ? document.pdf.numPages : 1;
  const button = "rounded px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40";
  return <section aria-label="Vista previa" className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-zinc-950 md:static md:w-[52%] md:border-r">
    <div className="flex items-center gap-3 border-b p-3 text-sm">
      <strong className="mr-auto">Vista previa</strong>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 md:hidden">Abrir original <ExternalLink size={15}/></a>
      <button ref={closeRef} onClick={close} className={button} aria-label="Cerrar vista previa"><X size={18}/></button>
    </div>
    <div className="flex items-center justify-between gap-2 border-b px-2 py-1 text-xs tabular-nums">
      <div>
        <button className={button} disabled={page <= 1} aria-label="Página anterior" onClick={() => setPage(page - 1)}>‹</button>
        <span aria-live="polite">Página {page} de {total}</span>
        <button className={button} disabled={page >= total} aria-label="Página siguiente" onClick={() => setPage(page + 1)}>›</button>
      </div>
      <div className="flex items-center gap-1">
        <button className={button} aria-label="Reducir zoom" disabled={zoom <= 50} onClick={() => setZoom(zoom - 25)}><Minus size={16}/></button>
        {zoom}%
        <button className={button} aria-label="Aumentar zoom" disabled={zoom >= 200} onClick={() => setZoom(zoom + 25)}><Plus size={16}/></button>
      </div>
    </div>
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-zinc-200 p-3 dark:bg-zinc-800">
      {failed ? <p role="status">No se pudo mostrar la vista previa. Podés abrir el original en otra pestaña.</p>
        : document?.kind === "pdf" ? <canvas ref={canvas} aria-label={`Página ${page} del comprobante`} className="mx-auto bg-white shadow"/>
        : document?.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={document.url} alt="Comprobante original" onError={() => setFailed(true)} className="mx-auto max-w-none shadow" style={{ width: zoom + "%" }}/>
        : <p role="status">Cargando comprobante…</p>}
    </div>
  </section>;
}
