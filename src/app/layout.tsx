import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PatternCAD Pro — Thiết kế rập may mặc tự động (Parametric Garment CAD)",
  description:
    "Nền tảng Parametric Garment Pattern CAD chuẩn xác đến 0.01mm: dựng rập thông số tức thì, nhảy size lồng nhau S-M-L-XL và xuất DXF tương thích Gerber AccuMark, Optitex, CLO3D.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-[#0F172A] selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
