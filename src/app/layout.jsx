import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
// Leaflet stilleri önce yüklenir; globals.css içindeki harita özelleştirmeleri onları ezebilsin.
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Lezzet Radarı · Akıllı Restoran Öneri ve Harita Uygulaması",
  description:
    "Konumuna göre çevrendeki restoran, kafe ve fast-food mekanlarını haritada gösterir; tercihlerine göre kişiselleştirilmiş öneriler sunar.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
