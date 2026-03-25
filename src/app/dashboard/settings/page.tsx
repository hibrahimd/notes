"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";

export default function UserSettingsPage() {
  const [settings, setSettings] = useState({
    preferredLanguage: "tr",
    translationLanguage: "tr",
    autoSummarize: true,
    autoTranslate: true,
    autoTranscribe: true,
    autoCategorize: true,
    openaiApiKeyEncrypted: "",
    deeplApiKeyEncrypted: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
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
    if (settings.openaiApiKeyEncrypted === "••••••••") delete body.openaiApiKeyEncrypted;
    if (settings.deeplApiKeyEncrypted === "••••••••") delete body.deeplApiKeyEncrypted;

    const res = await fetch("/api/settings", {
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

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Ayarlar</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardTitle>Dil Tercihleri</CardTitle>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tercih Edilen Dil</label>
              <select
                value={settings.preferredLanguage}
                onChange={(e) => setSettings({ ...settings, preferredLanguage: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Çeviri Dili</label>
              <select
                value={settings.translationLanguage}
                onChange={(e) => setSettings({ ...settings, translationLanguage: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Otomatik İşlemler</CardTitle>
          <div className="mt-4 space-y-3">
            {[
              { key: "autoSummarize", label: "Otomatik Özetleme" },
              { key: "autoTranslate", label: "Otomatik Çeviri" },
              { key: "autoTranscribe", label: "Otomatik Transkript" },
              { key: "autoCategorize", label: "Otomatik Kategorileme" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={(settings as Record<string, unknown>)[item.key] as boolean}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  className="rounded border-zinc-300"
                />
                {item.label}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>API Anahtarları (Kişisel)</CardTitle>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Kendi API anahtarlarınızı girerseniz, sistem genelindeki anahtarlar yerine bunlar kullanılır.
          </p>
          <div className="space-y-4">
            <Input
              id="openaiKey"
              label="OpenAI API Key"
              type="password"
              placeholder="sk-..."
              value={settings.openaiApiKeyEncrypted || ""}
              onChange={(e) => setSettings({ ...settings, openaiApiKeyEncrypted: e.target.value })}
            />
            <Input
              id="deeplKey"
              label="DeepL API Key"
              type="password"
              placeholder="DeepL API anahtarı"
              value={settings.deeplApiKeyEncrypted || ""}
              onChange={(e) => setSettings({ ...settings, deeplApiKeyEncrypted: e.target.value })}
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
