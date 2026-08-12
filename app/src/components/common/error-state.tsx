import { Button } from "@/components/ui/button";

export function ErrorState({
  message = "Não foi possível carregar os dados.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </section>
  );
}
