import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { KanbanBoard, resolveTaskDrop } from "./kanban-board";

const dnd = vi.hoisted(() => ({
  context: null as null | {
    onDragStart: (event: unknown) => void;
    onDragCancel: () => void;
    onDragEnd: (event: unknown) => void;
  },
}));

vi.mock("@dnd-kit/core", async () => {
  return {
    DndContext: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
      dnd.context = props as typeof dnd.context;
      return children;
    },
    DragOverlay: ({ children }: PropsWithChildren) => children,
    KeyboardSensor: class {},
    MouseSensor: class {},
    TouchSensor: class {},
    useSensor: vi.fn(() => ({})),
    useSensors: vi.fn((...sensors: unknown[]) => sensors),
    useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
    useDraggable: vi.fn(() => ({
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      listeners: {},
      attributes: {},
    })),
  };
});

function task(id: string, status: TaskCard["status"]): TaskCard {
  return {
    id,
    companyId: "company-a",
    requisitionId: null,
    title: `Task ${id}`,
    description: null,
    priority: "MEDIUM",
    status,
    assigneeId: null,
    startDate: null,
    plannedEndDate: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    assignee: null,
    requisition: null,
  };
}

describe("KanbanBoard", () => {
  it("renderiza sempre quatro colunas na ordem correta", () => {
    render(<KanbanBoard tasks={[task("1", "TODO"), task("2", "DONE")]} />);
    expect(
      ["A Fazer", "Em Andamento", "Pausado", "Concluído"].map((label) =>
        screen.getByRole("heading", { name: label }),
      ),
    ).toHaveLength(4);
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.getAllByText("Coluna vazia")).toHaveLength(2);
    expect(
      screen.getByText("Deslize horizontalmente para acessar todas as colunas."),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Colunas do board" })).toHaveClass(
      "kanban-board-scroll",
    );
    expect(screen.getByRole("region", { name: "Colunas do board" })).toHaveAttribute(
      "aria-describedby",
      "kanban-board-navigation-hint",
    );
  });

  it("mantém cards longos dentro de slots de coluna contidos", () => {
    const longTask = task("long", "TODO");
    longTask.title = "Título muito longo ".repeat(20);
    render(<KanbanBoard tasks={[longTask]} />);

    expect(screen.getByRole("heading", { name: /Título muito longo/ })).toHaveClass("break-words");
    expect(screen.getByRole("article")).toHaveClass("kanban-card");
    expect(screen.getByRole("article").closest(".kanban-board-column-slot")).toBeInTheDocument();
  });

  it("move por drag/drop válido e usa a Task ativa quando o fim não traz data", () => {
    const item = task("drag", "TODO");
    const onTransition = vi.fn();
    render(<KanbanBoard tasks={[item]} onTransition={onTransition} />);

    act(() => dnd.context?.onDragStart({ active: { data: { current: { task: item } } } }));
    expect(screen.getAllByText("Task drag")).toHaveLength(2);
    act(() =>
      dnd.context?.onDragEnd({
        active: { data: { current: undefined } },
        over: { data: { current: { status: "IN_PROGRESS" } } },
      }),
    );

    expect(onTransition).toHaveBeenCalledWith(item, "IN_PROGRESS");
    expect(screen.getAllByText("Task drag")).toHaveLength(1);
  });

  it("ignora drop sem destino, inválido ou sem Task e limpa overlay no cancelamento", () => {
    const item = task("drag", "TODO");
    const onTransition = vi.fn();
    render(<KanbanBoard tasks={[item]} onTransition={onTransition} />);

    act(() => dnd.context?.onDragStart({ active: { data: { current: { task: item } } } }));
    act(() =>
      dnd.context?.onDragEnd({ active: { data: { current: { task: item } } }, over: null }),
    );
    act(() =>
      dnd.context?.onDragEnd({
        active: { data: { current: { task: item } } },
        over: { data: { current: { status: "DONE" } } },
      }),
    );
    act(() =>
      dnd.context?.onDragEnd({
        active: { data: { current: undefined } },
        over: { data: { current: { status: "IN_PROGRESS" } } },
      }),
    );
    expect(onTransition).not.toHaveBeenCalled();

    act(() => dnd.context?.onDragStart({ active: { data: { current: { task: item } } } }));
    expect(screen.getAllByText("Task drag")).toHaveLength(2);
    act(() => dnd.context?.onDragCancel());
    expect(screen.getAllByText("Task drag")).toHaveLength(1);
  });

  it("revela o controle focado à esquerda e à direita sem rolar o próprio board", () => {
    render(<KanbanBoard tasks={[task("focus", "TODO")]} />);
    const board = screen.getByRole("region", { name: "Colunas do board" });
    const control = screen.getByRole("button", { name: "Mover tarefa Task focus" });
    const scrollTo = vi.fn();
    Object.defineProperties(board, {
      scrollLeft: { value: 40, writable: true },
      scrollTo: { value: scrollTo },
      getBoundingClientRect: {
        value: () => ({ left: 100, right: 500, width: 400 }),
      },
    });
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue({
      left: 50,
      right: 90,
      width: 40,
    } as DOMRect);
    fireEvent.focus(control);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: -10, behavior: "auto" });

    vi.mocked(control.getBoundingClientRect).mockReturnValue({
      left: 550,
      right: 650,
      width: 100,
    } as DOMRect);
    fireEvent.focus(control);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 340, behavior: "auto" });
    fireEvent.focus(board);
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});

describe("resolveTaskDrop", () => {
  it("resolve apenas Task, destino e transição válidos", () => {
    const item = task("1", "TODO");
    expect(resolveTaskDrop(item, "IN_PROGRESS")).toEqual({ task: item, status: "IN_PROGRESS" });
    expect(resolveTaskDrop(item, "DONE")).toBeNull();
    expect(resolveTaskDrop(null, "IN_PROGRESS")).toBeNull();
    expect(resolveTaskDrop(item, undefined)).toBeNull();
  });
});
