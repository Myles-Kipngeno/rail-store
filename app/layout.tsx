import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { BagDrawer } from "@/components/BagDrawer";
import { BagProvider } from "@/components/BagProvider";
import { STORE } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${STORE.name} · ${STORE.drop}`, template: `%s · ${STORE.name}` },
  description: STORE.description,
};

export const viewport: Viewport = { themeColor: "#eef0ed", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BagProvider>
          {children}
          <BagDrawer />
        </BagProvider>
      </body>
    </html>
  );
}
