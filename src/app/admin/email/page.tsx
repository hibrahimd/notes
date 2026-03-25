"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Save, Send } from "lucide-react";

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPasswordEncrypted: "",
    smtpFromName: "Not Al",
    smtpFromEmail: "",
    smtpSecure: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({
            ...prev,
            smtpHost: data.settings.smtpHost || "",
            smtpPort: data.settings.smtpPort || 587,
            smtpUsername: data.settings.smtpUsername || "",
            smtpPasswordEncrypted: "",
            smtpFromName: data.settings.smtpFromName || "Not Al",
            smtpFromEmail: data.settings.smtpFromEmail || "",
            smtpSecure: data.settings.smtpSecure || false,
          }));
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const body: Record<string, unknown> = { ...settings };
    if (!settings.smtpPasswordEncrypted) {
      delete body.smtpPasswordEncrypted;
    }

    const res = await fetch("/api/admin/system-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage("Email ayarları kaydedildi");
    } else {
      setMessage("Hata oluştu");
    }
    setSaving(false);
  }

  async function handleTestEmail() {
    setTesting(true);
    setMessage("");

    const res = await fetch("/api/admin/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage("Test emaili gönderildi!");
    } else {
      setMessage(`Hata: ${data.error}`);
    }
    setTesting(false);
  }

  if (loading) {
    return <div className="text-zinc-400">Yükleniyor...</div>;
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Email (SMTP) Ayarları</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardTitle>SMTP Sunucu</CardTitle>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="smtpHost"
              label="SMTP Host"
              placeholder="smtp.gmail.com"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
            />
            <Input
              id="smtpPort"
              label="SMTP Port"
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
            />
            <Input
              id="smtpUsername"
              label="Kullanıcı Adı"
              placeholder="user@example.com"
              value={settings.smtpUsername}
              onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
            />
            <Input
              id="smtpPassword"
              label="Şifre"
              type="password"
              placeholder="Değiştirmek için girin"
              value={settings.smtpPasswordEncrypted}
              onChange={(e) => setSettings({ ...settings, smtpPasswordEncrypted: e.target.value })}
            />
            <Input
              id="smtpFromName"
              label="Gönderen Adı"
              value={settings.smtpFromName}
              onChange={(e) => setSettings({ ...settings, smtpFromName: e.target.value })}
            />
            <Input
              id="smtpFromEmail"
              label="Gönderen Email"
              type="email"
              placeholder="noreply@example.com"
              value={settings.smtpFromEmail}
              onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={settings.smtpSecure}
                onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                className="rounded border-zinc-300"
              />
              SSL/TLS Kullan
            </label>
          </div>
        </Card>

        {message && (
          <p className={`text-sm ${message.includes("Hata") ? "text-red-500" : "text-emerald-500"}`}>
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={saving}>
            <Save size={16} /> Kaydet
          </Button>
        </div>
      </form>

      <Card className="mt-6">
        <CardTitle>Test Email Gönder</CardTitle>
        <div className="mt-4 flex gap-3">
          <Input
            id="testEmail"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button variant="outline" onClick={handleTestEmail} loading={testing} type="button">
            <Send size={16} /> Gönder
          </Button>
        </div>
      </Card>
    </>
  );
}
