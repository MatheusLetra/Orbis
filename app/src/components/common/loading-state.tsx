export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
