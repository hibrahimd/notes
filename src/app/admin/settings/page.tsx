"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState({
    defaultLanguage: "tr",
    supportedLanguages: ["tr", "en", "de", "fr", "es"],
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    anthropicApiKey: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const body: Record<string, unknown> = { ...settings };
    // Maskeli deger geri gonderilirse kayitli anahtar ezilmesin
    if (settings.openaiApiKey === "••••••••") delete body.openaiApiKey;
    if (settings.anthropicApiKey === "••••••••") delete body.anthropicApiKey;

    const res = await fetch("/api/admin/system-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage("Ayarlar kaydedildi");
    } else {
      setMessage("Hata oluştu");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-zinc-400">Yükleniyor...</div>;
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Sistem Ayarları</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardTitle>Dil Ayarları</CardTitle>
          <div className="mt-4 space-y-4">
            <Input
              id="defaultLanguage"
              label="Varsayılan Dil"
              value={settings.defaultLanguage}
              onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
            />
            <Input
              id="supportedLanguages"
              label="Desteklenen Diller (virgülle ayırın)"
              value={settings.supportedLanguages?.join(", ") || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  supportedLanguages: e.target.value.split(",").map((s) => s.trim()),
                })
              }
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Yapay Zekâ (Sistem Geneli)</CardTitle>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Kullanıcının kendi anahtarı yoksa bu anahtarlar kullanılır. Hiçbiri
            yoksa özet, çeviri ve kategori adımları atlanır ve not detayında
            belirtilir. Video transkripsiyonu her zaman OpenAI Whisper ile yapılır.
          </p>
          <div className="space-y-4">
            <Input
              id="openaiApiKey"
              label="OpenAI API Key"
              type="password"
              placeholder="sk-..."
              value={settings.openaiApiKey || ""}
              onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
            />
            <Input
              id="openaiModel"
              label="Varsayılan OpenAI Modeli"
              placeholder="gpt-4o-mini"
              value={settings.openaiModel || ""}
              onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
            />
            <Input
              id="anthropicApiKey"
              label="Anthropic API Key"
              type="password"
              placeholder="sk-ant-..."
              value={settings.anthropicApiKey || ""}
              onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
            />
          </div>
        </Card>

        {message && (
          <p className={`text-sm ${message.includes("Hata") ? "text-red-500" : "text-emerald-500"}`}>
            {message}
          </p>
        )}

        <Button type="submit" loading={saving}>
          <Save size={16} /> Kaydet
        </Button>
      </form>
    </>
  );
}
