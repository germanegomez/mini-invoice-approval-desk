"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ClassificationCatalogs } from "@/lib/tasks/repository";
import { choices, fieldLabels, fields, type Assignment, type Field } from "@/lib/tasks/classification";

type Option = { code: string; displayName: string };
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
const caption = (option: Option) => option.code + " · " + option.displayName;

function CatalogCombo({ id, field, options, value, invalid, onChange }: {
  id: string; field: Field; options: Option[]; value: string | null;
  invalid: boolean; onChange(code: string | null): void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const open = query !== null;
  const selected = options.find(entry => entry.code === value);
  const search = fold(query?.trim() ?? "");
  const matches = options.filter(option => fold(caption(option)).includes(search));
  const showEmpty = !search && (field === "subCostCenter" || Boolean(value));
  const entries: (Option | null)[] = showEmpty ? [...matches, null] : matches;
  const active = Math.min(index, entries.length - 1);
  const listId = id + "-options";
  function choose(option: Option | null) {
    onChange(option?.code ?? null);
    setQuery(null);
  }
  useEffect(() => {
    const menu = list.current;
    const row = menu?.children[active] as HTMLElement | undefined;
    if (!menu || !row || !open) return;
    if (row.offsetTop < menu.scrollTop) menu.scrollTop = row.offsetTop;
    if (row.offsetTop + row.offsetHeight > menu.scrollTop + menu.clientHeight)
      menu.scrollTop = row.offsetTop + row.offsetHeight - menu.clientHeight;
  }, [active, open]);

  return <div className="min-w-0">
    <label htmlFor={id} className="mb-1 block text-xs font-medium">
      {fieldLabels[field]}{field === "subCostCenter" && <span className="font-normal text-zinc-600 dark:text-zinc-400"> (opcional)</span>}
    </label>
    <div className="relative">
      <input id={id} role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? listId + "-" + active : undefined}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? id + "-error" : undefined}
        title={selected ? caption(selected) : undefined} value={open ? query ?? "" : selected ? caption(selected) : value ?? ""}
        placeholder="Código o descripción"
        className="w-full truncate rounded-md border border-zinc-300 bg-white py-2 pl-2 pr-7 text-xs text-zinc-900 placeholder:text-zinc-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60 aria-[invalid=true]:border-rose-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400"
        onFocus={() => { setQuery(""); setIndex(0); }}
        onClick={() => { if (!open) { setQuery(""); setIndex(0); } }}
        onChange={event => { setQuery(event.target.value); setIndex(0); }}
        onBlur={() => setQuery(null)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setQuery(null);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { setQuery(""); setIndex(0); }
            else setIndex(Math.max(0, Math.min(active + (event.key === "ArrowDown" ? 1 : -1), entries.length - 1)));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active >= 0) choose(entries[active]);
          }
        }} />
      <ChevronsUpDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500" />
    </div>
    {open && <ul id={listId} ref={list} role="listbox" aria-label={fieldLabels[field]}
      className="relative mt-1 max-h-44 overflow-y-auto overscroll-contain rounded-md border border-zinc-300 bg-white p-1 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      {entries.map((option, i) => <li role="option" id={listId + "-" + i} key={option?.code ?? ""}
        aria-selected={(option?.code ?? null) === value}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}
        className={"flex cursor-pointer items-start gap-1 rounded px-2 py-2 hover:bg-amber-100 dark:hover:bg-amber-950 " +
          (i === active ? "bg-amber-100 text-zinc-950 dark:bg-amber-950 dark:text-amber-100" : "")}>
        <span className="min-w-0 flex-1 break-words">{option ? <><strong className="font-mono">{option.code}</strong> · {option.displayName}</> :
          field === "subCostCenter" ? "Sin subcentro" : "Quitar selección"}</span>
        {option && option.code === value && <Check size={14} aria-hidden="true" />}
      </li>)}
      {!entries.length && <li role="presentation" className="px-2 py-2 text-zinc-600 dark:text-zinc-400">Sin coincidencias</li>}
    </ul>}
  </div>;
}

export function ClassificationFields({ value, catalog, onChange, groupId, error }: {
  value: Assignment; catalog: ClassificationCatalogs; onChange(next: Assignment): void;
  groupId?: string; error?: Field;
}) {
  const autoId = useId();
  const prefix = groupId ?? autoId;
  return <div className="grid items-start gap-3 sm:grid-cols-3">
    {fields.map(field => <CatalogCombo key={field} id={prefix + "-" + field} field={field}
      value={value[field]} options={choices(catalog, field)}
      invalid={error === field}
      onChange={code => onChange({ ...value, [field]: code })} />)}
  </div>;
}
