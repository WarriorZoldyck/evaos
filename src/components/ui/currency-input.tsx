import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  className,
  disabled = false,
}: CurrencyInputProps) {
  const formatBRL = (v: number): string => {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState(value ? formatBRL(value) : "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) {
      setDisplay("");
      onChange(0);
      return;
    }
    const numeric = parseInt(raw, 10) / 100;
    setDisplay(formatBRL(numeric));
    onChange(numeric);
  }

  useEffect(() => {
    if (value === 0) setDisplay("");
    else setDisplay(formatBRL(value));
  }, [value]);

  return (
    <Input
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={handleChange}
      className={className}
      disabled={disabled}
    />
  );
}
