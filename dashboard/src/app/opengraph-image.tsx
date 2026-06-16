import { ImageResponse } from "next/og";

export const alt = "Aforo de Sputnik Climbing en tiempo real";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card. Generated at build time (no runtime data), so it's
// statically cached. Uses the dashboard's near-black/white palette with a green
// "live" accent for the real-time angle.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "9999px",
              backgroundColor: "#22c55e",
            }}
          />
          <div style={{ fontSize: "30px", color: "#a1a1aa", letterSpacing: "2px" }}>
            EN TIEMPO REAL
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "76px", fontWeight: 700, lineHeight: 1.1 }}>
            Aforo de Sputnik Climbing
          </div>
          <div style={{ fontSize: "36px", color: "#a1a1aa" }}>
            Cuándo están más llenos los rocódromos
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
