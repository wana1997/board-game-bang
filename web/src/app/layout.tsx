import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/lib/SocketProvider";
import { RoomProvider } from "@/lib/RoomProvider";
import { GameProvider } from "@/lib/GameProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "프로젝트 뱅!",
  description: "BANG! 보드게임 웹 멀티플레이 클론",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SocketProvider>
          <RoomProvider>
            <GameProvider>{children}</GameProvider>
          </RoomProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
