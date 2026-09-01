import { describe, it, expect } from "vitest";
import { easterSunday, brazilHolidays, holidayMap } from "./brazilHolidays";

describe("brazilHolidays", () => {
  it("calcula a Páscoa corretamente", () => {
    expect(easterSunday(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
    expect(easterSunday(2024).toDateString()).toBe(new Date(2024, 2, 31).toDateString());
  });

  it("inclui feriados fixos e móveis", () => {
    const map = holidayMap(2026);
    expect(map["2026-09-07"]).toBe("Independência do Brasil");
    expect(map["2026-12-25"]).toBe("Natal");
    // Carnaval 2026 = 17/02, Sexta Santa = 03/04, Corpus Christi = 04/06
    expect(map["2026-02-17"]).toBe("Carnaval");
    expect(map["2026-04-03"]).toBe("Sexta-feira Santa");
    expect(map["2026-06-04"]).toBe("Corpus Christi");
  });

  it("retorna lista ordenada", () => {
    const list = brazilHolidays(2026).map((h) => h.date);
    expect([...list].sort()).toEqual(list);
  });
});
