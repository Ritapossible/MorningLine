// The card a link to the site unfurls into on X, Discord and chat apps. Drawn from code so it
// keeps the site's palette and never goes stale against a screenshot.
import { ImageResponse } from "next/og";

export const alt =
  "Morning Line: sponsor lines in GitHub READMEs, paid by the day on Base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DAYS = Array.from({ length: 30 }, (_, i) =>
  i === 12 || i === 13 ? "back" : i < 28 ? "paid" : "todo",
);

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#fdfaf5",
        padding: "64px 72px",
        fontFamily: "sans-serif",
        color: "#15192a",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24">
            <g stroke="#c2701a" strokeWidth="1.75" strokeLinecap="round">
              <path d="M12 4v2.4M5.6 7.2l1.6 1.6M18.4 7.2l-1.6 1.6" />
            </g>
            <path d="M6.5 16a5.5 5.5 0 0 1 11 0Z" fill="#c2701a" />
            <rect
              x="2"
              y="18"
              width="20"
              height="2.4"
              rx="1.2"
              fill="#15192a"
            />
          </svg>
          Morning Line
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            Sponsor lines,
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: "#c2701a",
            }}
          >
            paid by the day.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#6a7187",
              marginTop: 24,
              maxWidth: 620,
              lineHeight: 1.35,
            }}
          >
            USDC escrow on Base for a line in a GitHub README. Line up, the day
            is paid. Line gone, it goes back.
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#a85e12", fontWeight: 600 }}>
          morning-line-phi.vercel.app
        </div>
      </div>
      <div
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0b0f1b",
          borderRadius: 28,
          padding: 32,
          color: "#eef1f8",
          alignSelf: "center",
        }}
      >
        <div style={{ fontSize: 20, color: "#8f99b3" }}>Example deal</div>
        <div style={{ fontSize: 64, fontWeight: 800, marginTop: 8 }}>
          $30.00
        </div>
        <div style={{ fontSize: 20, color: "#8f99b3" }}>
          30 days · $1.00 a day · USDC
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 22 }}
        >
          {DAYS.map((d, i) => (
            <div
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background:
                  d === "paid"
                    ? "#f4a259"
                    : d === "back"
                      ? "#6f8fd6"
                      : "#232b44",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 19, color: "#8f99b3", marginTop: 18 }}>
          26 paid · 2 back · 2 to go
        </div>
      </div>
    </div>,
    size,
  );
}
