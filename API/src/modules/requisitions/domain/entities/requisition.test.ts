import { describe, expect, it } from "vitest";
import {
  Requisition,
  type RequisitionProps,
} from "@/modules/requisitions/domain/entities/requisition";

describe("Requisition", () => {
  it("cria uma requisição com os valores padrão", () => {
    const requisition = Requisition.create({
      companyId: "company-1",
      number: 100,
      title: "Nova funcionalidade",
      requesterId: "user-1",
    });

    expect(requisition.companyId).toBe("company-1");
    expect(requisition.number).toBe(100);
    expect(requisition.title).toBe("Nova funcionalidade");
    expect(requisition.requesterId).toBe("user-1");
    expect(requisition.priority).toBe("MEDIUM");
    expect(requisition.status).toBe("OPEN");
  });

  it("mantém os campos opcionais como null quando ausentes", () => {
    const requisition = Requisition.create({
      companyId: "company-1",
      number: 100,
      title: "Nova funcionalidade",
      requesterId: "user-1",
    });

    expect(requisition.description).toBeNull();
    expect(requisition.responsibleId).toBeNull();
    expect(requisition.systemId).toBeNull();
    expect(requisition.systemVersionId).toBeNull();
    expect(requisition.estimatedHours).toBeNull();
    expect(requisition.startDate).toBeNull();
    expect(requisition.plannedDeliveryDate).toBeNull();
    expect(requisition.deliveredAt).toBeNull();
  });

  it("preserva os campos opcionais informados", () => {
    const startDate = new Date("2026-08-11T00:00:00Z");
    const plannedDeliveryDate = new Date("2026-08-18T00:00:00Z");
    const deliveredAt = new Date("2026-08-18T15:30:00Z");
    const requisition = Requisition.create({
      companyId: "company-1",
      number: 100,
      title: "Nova funcionalidade",
      description: "  Detalhes da requisição  ",
      priority: "HIGH",
      requesterId: "user-1",
      responsibleId: "user-2",
      systemId: "system-1",
      systemVersionId: "version-1",
      estimatedHours: 12.5,
      startDate,
      plannedDeliveryDate,
      deliveredAt,
    });

    expect(requisition.description).toBe("Detalhes da requisição");
    expect(requisition.priority).toBe("HIGH");
    expect(requisition.responsibleId).toBe("user-2");
    expect(requisition.systemId).toBe("system-1");
    expect(requisition.systemVersionId).toBe("version-1");
    expect(requisition.estimatedHours).toBe(12.5);
    expect(requisition.startDate).toBe(startDate);
    expect(requisition.plannedDeliveryDate).toBe(plannedDeliveryDate);
    expect(requisition.deliveredAt).toBe(deliveredAt);
  });

  it("gera id e timestamps na criação", () => {
    const requisition = Requisition.create({
      companyId: "company-1",
      number: 100,
      title: "Nova funcionalidade",
      requesterId: "user-1",
    });

    expect(requisition.id).toEqual(expect.any(String));
    expect(requisition.createdAt).toBeInstanceOf(Date);
    expect(requisition.updatedAt).toBeInstanceOf(Date);
    expect(requisition.updatedAt).toBe(requisition.createdAt);
  });

  it("restaura uma requisição a partir das props persistidas", () => {
    const createdAt = new Date("2026-08-11T10:00:00Z");
    const updatedAt = new Date("2026-08-11T11:00:00Z");
    const props: RequisitionProps = {
      id: "requisition-1",
      companyId: "company-1",
      number: 100,
      title: "Requisição persistida",
      description: "Descrição persistida",
      priority: "LOW",
      status: "IN_PROGRESS",
      requesterId: "user-1",
      responsibleId: "user-2",
      systemId: "system-1",
      systemVersionId: "version-1",
      estimatedHours: 8,
      startDate: new Date("2026-08-11T00:00:00Z"),
      plannedDeliveryDate: new Date("2026-08-12T00:00:00Z"),
      deliveredAt: null,
      createdAt,
      updatedAt,
    };

    const requisition = Requisition.restore(props);

    expect(requisition.id).toBe("requisition-1");
    expect(requisition.companyId).toBe("company-1");
    expect(requisition.number).toBe(100);
    expect(requisition.priority).toBe("LOW");
    expect(requisition.status).toBe("IN_PROGRESS");
    expect(requisition.createdAt).toBe(createdAt);
    expect(requisition.updatedAt).toBe(updatedAt);
  });
});
