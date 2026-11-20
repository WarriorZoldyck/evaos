import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { CardTerminalInfo } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { InstallmentPreviewTable } from "./InstallmentPreviewTable";
import { PaymentMethodFields } from "./PaymentMethodFields";
import { calculateTerminalMdr } from "./MdrInfoCard";

const terminal = {
  id: "cielo", name: "Cielo", bank_account_id: "bank-cielo",
  credit_rate: 3.19, debit_rate: 1.5, settlement_days_credit: 1,
  rates_info: JSON.stringify([{ installments: 2, rate: 4.5 }, { installments: 3, rate: 5.2 }]),
} as CardTerminalInfo;
const date = new Date(2026, 10, 20);

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("card installment receipts", () => {
  it("uses the selected terminal's two-installment MDR instead of the cash rate", () => {
    const calc = calculateTerminalMdr({ terminal, amount: 2000, paymentMethod: "Cartão de Crédito", installmentsCount: 2, paymentDate: date });
    expect(calc?.rate).toBe(4.5);
    expect(calc?.type).toBe("lump_sum");
    if (calc?.type !== "lump_sum") throw new Error("Expected anticipated receipt");
    expect(calc.totalFee).toBe(90);
    expect(calc.totalNet).toBe(1910);
    expect(calc.settlementDate).toEqual(new Date(2026, 10, 21));
  });

  it("keeps the cash card rate unchanged", () => {
    const calc = calculateTerminalMdr({ terminal, amount: 2000, paymentMethod: "Cartão de Crédito", paymentDate: date });
    expect(calc?.type).toBe("single");
    if (calc?.type !== "single") throw new Error("Expected single receipt");
    expect(calc.rate).toBe(3.19);
    expect(calc.feeAmount).toBe(63.8);
    expect(calc.netAmount).toBe(1936.2);
  });

  it("updates the rate when the number of installments changes", () => {
    const calc = calculateTerminalMdr({ terminal, amount: 2000, paymentMethod: "Cartão de Crédito", installmentsCount: 3, paymentDate: date });
    expect(calc?.rate).toBe(5.2);
    if (calc?.type !== "lump_sum") throw new Error("Expected anticipated receipt");
    expect(calc.totalFee).toBe(104);
    expect(calc.totalNet).toBe(1896);
  });

  it("retains the chosen terminal and receiving account after selecting the card modality", async () => {
    const save = vi.fn();
    function ReceiptForm() {
      const form = useForm({ defaultValues: { amount: 2000, is_installment: true, installments_count: 2, competence_date: date, payment_method: "", card_terminal_id: "", bank_account_id: "" } });
      const [method, setMethod] = useState("");
      return <Form {...form}><form onSubmit={form.handleSubmit(save)}>
        <InstallmentPreviewTable totalAmount={2000} installmentsCount={2} paymentDate={date}
          intervalType="monthly" interestRate={0} customAmounts={{}} onCustomAmountsChange={() => {}}
          defaultMethod={method} showInstallmentRows={!method}
          onModalitiesChange={(methods) => { const next = methods.length === 1 ? methods[0] : ""; setMethod(next); form.setValue("payment_method", next); }}
          paymentFields={method ? <PaymentMethodFields form={form} activeTab="receita" paymentMethod={method}
            bankAccounts={[]} wallets={[]} creditCards={[]} cardTerminals={[terminal]} /> : undefined}
        />
        <Button type="submit">Salvar</Button>
      </form></Form>;
    }
    render(<ReceiptForm />);
    fireEvent.click(screen.getByRole("button", { name: /Cartão de Crédito/ }));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Cielo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toMatchObject({ amount: 2000, installments_count: 2,
      payment_method: "Cartão de Crédito", card_terminal_id: "cielo", bank_account_id: "bank-cielo" });
  });
});