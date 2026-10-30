import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Mercato Admin Console",
    template: "%s | Mercato Admin",
  },
  description: "Operations and administration portal for Mercato.",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-zinc-100 antialiased selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
