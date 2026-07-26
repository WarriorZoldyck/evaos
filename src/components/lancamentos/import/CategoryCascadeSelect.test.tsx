import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryCascadeSelect } from "./CategoryCascadeSelect";
import type { CategoryFlat } from "@/components/lancamentos/CategoryPathCombobox";

// Radix Popover/Command need pointer-related APIs jsdom doesn't ship with.
beforeAll(() => {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
});


const cats: CategoryFlat[] = [
  { id: "r1", name: "Alimentação", parent_id: null, type: "despesa" },
  { id: "r1s1", name: "Restaurante", parent_id: "r1", type: "despesa" },
  { id: "r2", name: "Alimentação", parent_id: null, type: "despesa" },
  { id: "r2s1", name: "Mercado", parent_id: "r2", type: "despesa" },
];

describe("CategoryCascadeSelect", () => {
  it("shows subcategory of the branch chosen by name — not the first collision", () => {
    const onChange = vi.fn();
    // value points to root "Alimentação" + sub "Mercado" (which only exists in r2)
    render(
      <CategoryCascadeSelect
        categories={cats}
        value={{ category: "Alimentação", subcategory: "Mercado" }}
        type="despesa"
        onChange={onChange}
      />,
    );

    // Open the subcategory popover (2nd trigger)
    const triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[1]!);

    // "Mercado" must be visible as an option — proves we picked r2, not r1
    const options = screen.getAllByRole("option");
    const optionNames = options.map((o) => o.textContent);
    expect(optionNames.some((n) => n?.includes("Mercado"))).toBe(true);
    expect(optionNames.some((n) => n?.includes("Restaurante"))).toBe(false);
  });

  it("re-renders subs after value switch (simulates changing row)", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CategoryCascadeSelect
        categories={cats}
        value={{ category: "Alimentação", subcategory: "Restaurante" }}
        type="despesa"
        onChange={onChange}
      />,
    );

    let triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[1]!);
    let optionNames = screen.getAllByRole("option").map((o) => o.textContent);
    expect(optionNames.some((n) => n?.includes("Restaurante"))).toBe(true);

    fireEvent.keyDown(document.body, { key: "Escape" });
    rerender(
      <CategoryCascadeSelect
        categories={cats}
        value={{ category: "Alimentação", subcategory: "Mercado" }}
        type="despesa"
        onChange={onChange}
      />,
    );

    triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[1]!);
    optionNames = screen.getAllByRole("option").map((o) => o.textContent);
    expect(optionNames.some((n) => n?.includes("Mercado"))).toBe(true);
  });
});

