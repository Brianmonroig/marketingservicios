import type { Metadata, Viewport } from "next";
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./tailwind.css";
import "./north.css";
import "./globals.css";

// Mismas tres familias que la referencia North Scale.
const sans = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-inter-tight" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "North Scale — CRM para agencias con Meta Lead Ads y WhatsApp",
  description:
    "North Scale reúne los leads de Meta Lead Ads y las conversaciones de WhatsApp de cada agencia en un solo espacio, con roles y datos separados por agencia.",
};

export const viewport: Viewport = {
  themeColor: "#07080a",
};

// Las animaciones de entrada solo se ocultan si hay JavaScript. Si el efecto no arranca
// en 2,5 s, la página se muestra igualmente.
const bootScript = `document.documentElement.classList.add("js");setTimeout(function(){if(!window.__NS_BOOT__)document.documentElement.classList.add("no-anim")},2500);`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
