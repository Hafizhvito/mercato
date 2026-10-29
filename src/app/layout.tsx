import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Mercato",
    template: "%s | Mercato",
  },
  description: "Modern production-grade e-commerce platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
