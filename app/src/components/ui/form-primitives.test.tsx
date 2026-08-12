import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";

describe("form primitives", () => {
  it("associa label a input e textarea", () => {
    render(
      <>
        <Label htmlFor="title">Título</Label>
        <Input id="title" />
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" />
      </>,
    );
    expect(screen.getByLabelText("Título")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText("Descrição")).toBeInstanceOf(HTMLTextAreaElement);
  });
});
