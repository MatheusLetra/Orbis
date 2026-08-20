import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export interface LookupItem {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface LookupPage {
  items: LookupItem[];
  nextCursor: string | null;
}

export interface LookupDefinition {
  entity: string;
  companyId: string;
  capability: string;
  queryKey: (search: string) => readonly unknown[];
  search: (
    input: { search: string; cursor?: string },
    options: { signal: AbortSignal },
  ) => Promise<LookupPage>;
}

export function IdLookupField({
  label,
  value,
  displayValue,
  placeholder = "Informe ou selecione um ID",
  disabled = false,
  required = false,
  name,
  lookup,
  initialItems = [],
  onChange,
}: {
  label: string;
  value: string;
  displayValue: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  lookup?: LookupDefinition;
  initialItems?: LookupItem[];
  onChange: (value: LookupItem | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedLabel = displayValue || value;
  const inputId = `${label.toLowerCase().replaceAll(/\s+/g, "-")}-lookup-input`;

  function close() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex min-w-0 gap-2">
        <Input
          id={inputId}
          value={value}
          name={name}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={(event) =>
            onChange(
              event.target.value ? { id: event.target.value, label: event.target.value } : null,
            )
          }
          aria-label={`${label} ID`}
        />
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`Buscar ${label.toLowerCase()}`}
          disabled={disabled || !lookup}
          onClick={() => setOpen(true)}
        >
          <Search aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`Limpar ${label.toLowerCase()}`}
          disabled={disabled || !value}
          onClick={() => onChange(null)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="break-words text-xs text-muted-foreground" aria-live="polite">
        {selectedLabel ? `Selecionado: ${selectedLabel}` : "Nenhum registro selecionado"}
      </p>
      {lookup && (
        <RecordLookupDialog
          open={open}
          label={label}
          lookup={lookup}
          initialItems={initialItems}
          selectedId={value}
          onClose={close}
          onSelect={(item) => {
            onChange(item);
            close();
          }}
        />
      )}
    </div>
  );
}

export function RecordLookupDialog({
  open,
  label,
  lookup,
  initialItems,
  selectedId,
  onClose,
  onSelect,
}: {
  open: boolean;
  label: string;
  lookup: LookupDefinition;
  initialItems: LookupItem[];
  selectedId: string;
  onClose: () => void;
  onSelect: (item: LookupItem) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 180);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: lookup.queryKey(debouncedSearch),
    queryFn: ({ pageParam, signal }) =>
      lookup.search(
        { search: debouncedSearch, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: open,
  });
  const fetchedItems = query.data?.pages.flatMap((page) => page.items) ?? [];
  const items = query.isSuccess ? fetchedItems : filterItems(initialItems, debouncedSearch);
  const titleId = `record-lookup-title-${lookup.entity}`;

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    document.querySelector<HTMLElement>(`[data-lookup-option="${lookup.entity}"]`)?.focus();
  }

  return (
    <ResponsiveDialog open={open} titleId={titleId} initialFocusRef={searchRef} onClose={onClose}>
      <header className="responsive-dialog-header">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold">
            Buscar {label}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pesquise pelo nome ou identificador amigável.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </header>
      <main className="responsive-dialog-main">
        <Label htmlFor={`${titleId}-search`}>Busca</Label>
        <Input
          ref={searchRef}
          id={`${titleId}-search`}
          className="mt-2 h-11"
          value={search}
          placeholder="Digite para buscar"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-controls={`${titleId}-options`}
        />
        <div
          id={`${titleId}-options`}
          className="mt-4 grid gap-2"
          role="listbox"
          aria-label={`Resultados de ${label}`}
        >
          {query.isPending && <p role="status">Carregando...</p>}
          {query.isError && (
            <div className="grid gap-2" role="alert">
              <p>Não foi possível carregar os registros.</p>
              <Button type="button" variant="outline" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!query.isPending && !query.isError && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedId}
              aria-disabled={item.disabled || undefined}
              disabled={item.disabled}
              tabIndex={index === 0 ? 0 : -1}
              data-lookup-option={lookup.entity}
              className="grid min-h-11 gap-0.5 rounded-md border p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(item)}
              onKeyDown={(event) =>
                handleOptionKeyDown(event, lookup.entity, index, items.length, onSelect, item)
              }
            >
              <span className="break-words font-medium">{item.label}</span>
              {item.description && (
                <span className="break-words text-xs text-muted-foreground">
                  {item.description}
                </span>
              )}
            </button>
          ))}
          {query.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </Button>
          )}
        </div>
      </main>
    </ResponsiveDialog>
  );
}

function filterItems(items: LookupItem[], search: string): LookupItem[] {
  const normalized = search.toLocaleLowerCase();
  return items.filter((item) =>
    `${item.label} ${item.description ?? ""}`.toLocaleLowerCase().includes(normalized),
  );
}

function handleOptionKeyDown(
  event: React.KeyboardEvent<HTMLButtonElement>,
  entity: string,
  index: number,
  count: number,
  onSelect: (item: LookupItem) => void,
  item: LookupItem,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect(item);
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const nextIndex =
    event.key === "ArrowDown" ? Math.min(index + 1, count - 1) : Math.max(index - 1, 0);
  document.querySelectorAll<HTMLElement>(`[data-lookup-option="${entity}"]`)[nextIndex]?.focus();
}
