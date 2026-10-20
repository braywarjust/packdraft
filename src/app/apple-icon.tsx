import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

// The iPhone home-screen icon: the PackDraft logo on the Pack Shop's blue-to-red sunburst. iOS rounds the corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const RAYS = Array.from({ length: 20 }, (_, i) => {
  const a = (i * Math.PI) / 10, b = a + Math.PI / 20;
  const p = (t: number) => `${(90 + 200 * Math.cos(t)).toFixed(1)} ${(90 + 200 * Math.sin(t)).toFixed(1)}`;
  return `M90 90L${p(a)}L${p(b)}Z`;
}).join("");

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export default function AppleIcon() {
  const logo = fs.readFileSync(path.join(process.cwd(), "public/packdraft-logo-full.svg"), "utf8");
  const background = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0253a4"/><stop offset=".55" stop-color="#0b4fa0"/><stop offset="1" stop-color="#cc2b31"/></linearGradient>
      <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="180" height="180" fill="url(#g)"/>
    <path d="${RAYS}" fill="#fff" opacity=".13"/>
    <circle cx="90" cy="90" r="80" fill="url(#glow)"/>
  </svg>`);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={background} width={180} height={180} style={{ position: "absolute", left: 0, top: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={svgUri(logo)} width={150} height={83} style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.45))" }} />
      </div>
    ),
    size,
  );
}
