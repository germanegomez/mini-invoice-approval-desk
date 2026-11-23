"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, X } from "lucide-react";

export function OriginalPreview({ url, close }: { url: string; close(): void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus(); }, []);
  return <section aria-label="Vista previa" className="absolute inset-0 z-10 flex min-h-0 flex-col bg-white dark:bg-zinc-950 md:static md:w-[52%] md:border-r">
    <div className="flex items-center gap-3 border-b p-3 text-sm">
      <strong className="mr-auto">Vista previa</strong>
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 md:hidden">Abrir original <ExternalLink size={15}/></a>
      <button ref={closeButton} onClick={close} className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Cerrar vista previa"><X size={18}/></button>
    </div>
    <iframe title="Comprobante original en Google Drive" src={url + "?preview=1"} referrerPolicy="no-referrer"
      className="min-h-0 w-full flex-1 border-0 bg-zinc-100 dark:bg-zinc-800" />
  </section>;
}
