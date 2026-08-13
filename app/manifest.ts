import type { MetadataRoute } from "next";

// Androidの「ホーム画面に追加」でネイティブアプリ同様のアイコン・起動になるようにする。
// maskable版は全面塗りつぶし(Android側が円や角丸に切り抜く)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kakeibo Demo",
    short_name: "Kakeibo",
    description:
      "スマホから収支を入力する家計簿アプリ(ポートフォリオ用デモ)",
    start_url: "/",
    display: "standalone",
    background_color: "#111316",
    theme_color: "#111316",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
