import { Geist, Geist_Mono, Inter } from "next/font/google"

import "@repo/ui/globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@repo/ui/lib/utils";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Recallio",
  description: "Your personal AI knowledge base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
