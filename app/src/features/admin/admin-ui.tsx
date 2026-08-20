import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ApiError } from "@/lib/http/api-error";

export function messageForAdminError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 422)
      return error.message || "Revise os dados informados.";
    if (error.status === 403) return "Você não tem permissão para realizar esta alteração.";
    if (error.status === 404)
      return "O registro não foi encontrado. Atualize a lista e tente novamente.";
    if (error.status === 409)
      return "A alteração entrou em conflito com outra operação. Tente novamente.";
    if (error.status >= 500) return "A API não conseguiu concluir a alteração. Tente novamente.";
  }
  return "Não foi possível salvar. Verifique sua conexão e tente novamente.";
}

export function adminActionError(action: { isError: boolean; error: unknown }): string | undefined {
  return action.isError ? messageForAdminError(action.error) : undefined;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function State({
  pending,
  error,
  empty,
  retry,
  children,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  retry?: () => void;
  children: ReactNode;
}) {
  if (pending) return <p aria-busy="true">Carregando...</p>;
  if (error)
    return (
      <p role="alert" className="text-destructive">
        <span>Não foi possível carregar os dados.</span>
        {retry && (
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Tentar novamente
          </Button>
        )}
      </p>
    );
  if (empty)
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum registro encontrado.
      </div>
    );
  return children;
}
export function Cards({ children }: { children: ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}
export function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{title}</h2>
          {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </article>
  );
}
export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`admin-${name}`}>{label}</Label>
      <Input
        id={`admin-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}
export function SelectField({
  label,
  name,
  defaultValue,
  value,
  children,
  required = false,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  children: ReactNode;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`admin-${name}`}>{label}</Label>
      <select
        id={`admin-${name}`}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
export function FormDialog({
  open,
  title,
  pending,
  error,
  onClose,
  onSubmit,
  children,
  submit = true,
}: {
  open: boolean;
  title: string;
  pending: boolean;
  error?: boolean | string;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  children: ReactNode;
  submit?: boolean;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  };
  return (
    <ResponsiveDialog open={open} titleId="admin-dialog-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex max-h-[90dvh] w-full flex-col">
        <div className="border-b p-5">
          <h2 id="admin-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5">
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {typeof error === "string"
                ? error
                : "Não foi possível salvar. Revise os dados e tente novamente."}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {submit && (
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </div>
      </form>
    </ResponsiveDialog>
  );
}
