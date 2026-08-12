import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskCard } from "@/features/tasks/task-contracts";
import { KanbanBoard } from "./kanban-board";

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
  });
});
