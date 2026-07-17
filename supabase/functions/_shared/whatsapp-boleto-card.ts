// Renders a "sugestão de baixa" card as PNG for WhatsApp using satori + resvg-wasm.
// Light theme to match Análises EVA card. Returns null on failure so the caller
// can fall back to plain text.

import satori from "npm:satori@0.10.13";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

const RESVG_WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf";
const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf";

let resvgReady: Promise<void> | null = null;
let fontRegular: ArrayBuffer | null = null;
let fontBold: ArrayBuffer | null = null;

async function ensureReady(): Promise<void> {
  if (!resvgReady) {
    resvgReady = (async () => {
      const wasmRes = await fetch(RESVG_WASM_URL);
      if (!wasmRes.ok) throw new Error(`resvg wasm fetch failed: ${wasmRes.status}`);
      await initWasm(await wasmRes.arrayBuffer());
    })();
  }
  await resvgReady;
  if (!fontRegular) {
    const r = await fetch(FONT_REGULAR_URL);
    if (!r.ok) throw new Error(`Inter regular fetch failed: ${r.status}`);
    fontRegular = await r.arrayBuffer();
  }
  if (!fontBold) {
    const r = await fetch(FONT_BOLD_URL);
    if (!r.ok) throw new Error(`Inter bold fetch failed: ${r.status}`);
    fontBold = await r.arrayBuffer();
  }
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export interface BoletoCardData {
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string | null;
  matchScore: number;
  type?: "despesa" | "receita";
  bankAccountName?: string | null;
}

/**
 * Renders the card as PNG (Uint8Array). Returns null if rendering fails —
 * caller must have a text-only fallback.
 */
export async function renderBoletoCardPng(data: BoletoCardData): Promise<Uint8Array | null> {
  try {
    await ensureReady();

    const scoreLabel =
      data.matchScore >= 3 ? "Match forte" : data.matchScore >= 2 ? "Match provável" : "Possível match";
    const isReceita = data.type === "receita";
    const typeLabel = isReceita ? "Receita" : "Despesa";
    const typeBg = isReceita ? "#DCFCE7" : "#FEE2E2";
    const typeFg = isReceita ? "#166534" : "#991B1B";
    const valorColor = isReceita ? "#16A34A" : "#DC2626";

    const tree: any = {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "800px",
          height: "500px",
          background: "#FFFFFF",
          padding: "36px 40px",
          fontFamily: "Inter",
          color: "#0F172A",
          border: "1px solid #E2E8F0",
          borderRadius: "24px",
        },
        children: [
          // Header: type chip + status chip
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 14px",
                      borderRadius: "999px",
                      background: typeBg,
                      color: typeFg,
                      fontSize: "13px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                    },
                    children: typeLabel.toUpperCase(),
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 14px",
                      borderRadius: "999px",
                      background: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "13px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                    },
                    children: `PENDENTE • ${scoreLabel.toUpperCase()}`,
                  },
                },
              ],
            },
          },
          // spacer
          { type: "div", props: { style: { height: "24px" }, children: "" } },
          // descrição
          {
            type: "div",
            props: {
              style: {
                fontSize: "26px",
                fontWeight: 700,
                lineHeight: 1.25,
                color: "#0F172A",
                maxHeight: "80px",
                overflow: "hidden",
              },
              children: data.descricao || "Lançamento pendente",
            },
          },
          // fornecedor + banco
          {
            type: "div",
            props: {
              style: {
                marginTop: "10px",
                display: "flex",
                flexDirection: "column",
                fontSize: "15px",
                color: "#64748B",
                gap: "4px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: { display: "flex" },
                    children: data.fornecedor ? `👤 ${data.fornecedor}` : " ",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: { display: "flex" },
                    children: data.bankAccountName ? `🏦 ${data.bankAccountName}` : " ",
                  },
                },
              ],
            },
          },
          // spacer
          { type: "div", props: { style: { flexGrow: 1 }, children: "" } },
          // valor + vencimento
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                borderTop: "1px solid #E2E8F0",
                paddingTop: "20px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: { fontSize: "12px", color: "#64748B", letterSpacing: "0.5px", fontWeight: 700 },
                          children: "VALOR",
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "40px",
                            fontWeight: 700,
                            color: valorColor,
                            lineHeight: 1,
                            marginTop: "6px",
                          },
                          children: fmtBRL(data.valor),
                        },
                      },
                    ],
                  },
                },
                {
                  type: "div",
                  props: {
                    style: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: { fontSize: "12px", color: "#64748B", letterSpacing: "0.5px", fontWeight: 700 },
                          children: "VENCIMENTO",
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "26px",
                            fontWeight: 700,
                            color: "#0F172A",
                            marginTop: "6px",
                          },
                          children: fmtDateBR(data.vencimento),
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // footer selo
          {
            type: "div",
            props: {
              style: {
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "#94A3B8",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: { display: "flex", alignItems: "center", gap: "8px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            borderRadius: "6px",
                            background: "#0B1120",
                            color: "#48CAE4",
                            fontWeight: 700,
                            fontSize: "13px",
                          },
                          children: "E",
                        },
                      },
                      {
                        type: "div",
                        props: { style: { display: "flex" }, children: "EVA OS · Sugestão de baixa" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const svg = await satori(tree, {
      width: 800,
      height: 500,
      fonts: [
        { name: "Inter", data: fontRegular!, weight: 400, style: "normal" },
        { name: "Inter", data: fontBold!, weight: 700, style: "normal" },
      ],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 800 } })
      .render()
      .asPng();
    return png;
  } catch (err) {
    console.error("renderBoletoCardPng failed:", (err as Error)?.message || err);
    return null;
  }
}
