import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["jsdom", "pg", "@prisma/adapter-pg", "ioredis", "bullmq"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        // iOS, kisayol dosyasini ancak dogru MIME tipiyle sunuldugunda
        // Kisayollar uygulamasina devrediyor; application/octet-stream ile
        // sadece isimsiz bir indirme olarak gorunuyor.
        //
        // Iki dosya da sunuluyor: iOS ice aktarirken kisayolun adini dosya
        // adindan aliyor (plist'teki WFWorkflowName'den degil), bu yuzden
        // dogru ad Turkce olani. Yuzde kodlamasi cozulmezse ASCII olana
        // donebilmek icin o da duruyor.
        source: "/:file(Notlarima-Ekle.shortcut|Notlar%C4%B1ma%20Ekle.shortcut|Notlarıma Ekle.shortcut)",
        headers: [
          { key: "Content-Type", value: "application/x-shortcut" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
