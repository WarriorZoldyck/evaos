// Renders a "sugestão de baixa" card as PNG for WhatsApp using satori + resvg-wasm.
// Both are pure WASM/JS and run on Deno Deploy. Any failure returns null so the
// caller can fall back to plain text.

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

    // satori tree — flexbox, tailwind-ish inline styles.
    const tree: any = {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "800px",
          height: "500px",
          background: "linear-gradient(135deg, #0B1120 0%, #0F1B33 100%)",
          padding: "36px 40px",
          fontFamily: "Inter",
          color: "#E6F1FF",
          border: "2px solid #48CAE4",
          borderRadius: "24px",
        },
        children: [
          // header
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
                    style: { display: "flex", alignItems: "center", gap: "12px" },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            background: "#48CAE4",
                            color: "#0B1120",
                            fontWeight: 700,
                            fontSize: "22px",
                          },
                          children: "E",
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: { display: "flex", flexDirection: "column" },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: { fontSize: "20px", fontWeight: 700, letterSpacing: "0.5px" },
                                children: "EVA OS",
                              },
                            },
                            {
                              type: "div",
                              props: {
                                style: { fontSize: "13px", color: "#7CC7DC" },
                                children: "Sugestão de baixa",
                              },
                            },
                          ],
                        },
                      },
                    ],
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
                      background: "rgba(250, 204, 21, 0.15)",
                      color: "#FACC15",
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
          // divider spacer
          { type: "div", props: { style: { height: "28px" }, children: "" } },
          // descrição
          {
            type: "div",
            props: {
              style: {
                fontSize: "22px",
                fontWeight: 700,
                lineHeight: 1.25,
                color: "#FFFFFF",
                maxHeight: "84px",
                overflow: "hidden",
              },
              children: data.descricao || "Lançamento pendente",
            },
          },
          // fornecedor
          {
            type: "div",
            props: {
              style: {
                marginTop: "8px",
                fontSize: "15px",
                color: "#94B8D9",
              },
              children: data.fornecedor ? `👤 ${data.fornecedor}` : " ",
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
                borderTop: "1px solid rgba(72, 202, 228, 0.25)",
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
                          style: { fontSize: "13px", color: "#7CC7DC", letterSpacing: "0.5px" },
                          children: "VALOR",
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "42px",
                            fontWeight: 700,
                            color: "#48CAE4",
                            lineHeight: 1,
                            marginTop: "4px",
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
                          style: { fontSize: "13px", color: "#7CC7DC", letterSpacing: "0.5px" },
                          children: "VENCIMENTO",
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "26px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            marginTop: "4px",
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
