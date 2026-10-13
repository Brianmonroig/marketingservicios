import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Marketing Servicios Local",
  description: "CRM para agencias que venden marketing a negocios de servicios a domicilio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${sans.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
