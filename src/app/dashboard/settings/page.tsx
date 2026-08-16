"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import {
  modelsFor,
  defaultModelFor,
  TRANSCRIBE_MODELS,
  DEFAULT_TRANSCRIBE_MODEL,
  type ModelOption,
} from "@/lib/ai-models";

type Provider = "openai" | "anthropic";
type Task = "summarize" | "translate" | "categorize";

interface SettingsState {
  preferredLanguage: string;
  translationLanguage: string;
  autoSummarize: boolean;
  autoTranslate: boolean;
  autoTranscribe: boolean;
  autoCategorize: boolean;
  openaiApiKeyEncrypted: string;
  anthropicApiKeyEncrypted: string;
  summarizeProvider: Provider;
  summarizeModel: string;
  translateProvider: Provider;
  translateModel: string;
  categorizeProvider: Provider;
  categorizeModel: string;
  transcribeModel: string;
}

const TASKS: { task: Task; label: string; hint: string }[] = [
  {
    task: "translate",
    label: "Çeviri",
    hint: "İşlerin en zoru — üslup ve terim tutarlılığı ister",
  },
  {
    task: "summarize",
    label: "Özet",
    hint: "Orta zorlukta; akıcı Türkçe yazması gerekir",
  },
  {
    task: "categorize",
    label: "Kategori",
    hint: "Kolay — sabit listeden seçim, ucuz model yeter",
  },
];

const MASK = "••••••••";

/** Saglayici + model ikilisi icin ortak satir. */
function ProviderRow({
  label,
  hint,
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  label: string;
  hint: string;
  provider: Provider;
  model: string;
  onProviderChange: (value: Provider) => void;
  onModelChange: (value: string) => void;
}) {
  const options: ModelOption[] = modelsFor(provider);
  const known = options.some((m) => m.id === model);
  const selectClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <div className="py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0">
      <div className="mb-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <p className="text-xs text-zinc-400">{hint}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          aria-label={`${label} sağlayıcı`}
          value={provider}
          onChange={(e) => {
            const next = e.target.value as Provider;
            onProviderChange(next);
            // Saglayici degisince modeli de o saglayicinin varsayilanina al,
            // yoksa gecersiz bir model kimligi kalir
            onModelChange(defaultModelFor(next));
          }}
          className={selectClass}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic (Claude)</option>
        </select>

        <select
          aria-label={`${label} model`}
          value={known ? model : "__custom"}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              onModelChange("");
            } else {
              onModelChange(e.target.value);
            }
          }}
          className={selectClass}
        >
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.hint ? ` — ${m.hint}` : ""}
            </option>
          ))}
          <option value="__custom">Diğer (elle gir)</option>
        </select>
      </div>

      {!known && (
        <div className="mt-3">
          <Input
            id={`${label}-custom-model`}
            placeholder="Model kimliğini birebir yazın"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function UserSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    preferredLanguage: "tr",
    translationLanguage: "tr",
    autoSummarize: false,
    autoTranslate: false,
    autoTranscribe: false,
    autoCategorize: false,
    openaiApiKeyEncrypted: "",
    anthropicApiKeyEncrypted: "",
    summarizeProvider: "openai",
    summarizeModel: defaultModelFor("openai"),
    translateProvider: "openai",
    translateModel: defaultModelFor("openai"),
    categorizeProvider: "openai",
    categorizeModel: defaultModelFor("openai"),
    transcribeModel: DEFAULT_TRANSCRIBE_MODEL,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            // Kayitli model bossa varsayilani goster
            summarizeModel:
              data.settings.summarizeModel ||
              defaultModelFor(data.settings.summarizeProvider || "openai"),
            translateModel:
              data.settings.translateModel ||
              defaultModelFor(data.settings.translateProvider || "openai"),
            categorizeModel:
              data.settings.categorizeModel ||
              defaultModelFor(data.settings.categorizeProvider || "openai"),
            transcribeModel:
              data.settings.transcribeModel || DEFAULT_TRANSCRIBE_MODEL,
          }));
        }
        setLoading(false);
      });
  }, []);

  const update = (patch: Partial<SettingsState>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const body: Record<string, unknown> = { ...settings };
    // Maskeli deger geri gonderilirse kayitli anahtar ezilmesin
    if (settings.openaiApiKeyEncrypted === MASK) delete body.openaiApiKeyEncrypted;
    if (settings.anthropicApiKeyEncrypted === MASK)
      delete body.anthropicApiKeyEncrypted;

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setMessage(res.ok ? "Ayarlar kaydedildi" : "Hata oluştu");
    setSaving(false);
  }

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  const selectClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Ayarlar
      </h1>

      <form onSubmit={handleSave} className="space-y-6 pb-24">
        <Card>
          <CardTitle>Dil Tercihleri</CardTitle>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tercih Edilen Dil
              </label>
              <select
                value={settings.preferredLanguage}
                onChange={(e) => update({ preferredLanguage: e.target.value })}
                className={selectClass}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Çeviri Dili
              </label>
              <select
                value={settings.translationLanguage}
                onChange={(e) => update({ translationLanguage: e.target.value })}
                className={selectClass}
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
          <p className="text-sm text-zinc-500 mt-1 mb-3">
            Kapalıyken not detayındaki butonlardan tek tek tetiklersiniz.
          </p>
          <div className="space-y-3">
            {[
              { key: "autoSummarize", label: "Otomatik Özetleme" },
              { key: "autoTranslate", label: "Otomatik Çeviri" },
              { key: "autoCategorize", label: "Otomatik Kategorileme" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={Boolean(settings[item.key as keyof SettingsState])}
                  onChange={(e) =>
                    update({ [item.key]: e.target.checked } as Partial<SettingsState>)
                  }
                  className="rounded border-zinc-300"
                />
                {item.label}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>İşlem Sağlayıcıları</CardTitle>
          <p className="text-sm text-zinc-500 mt-1">
            Her işlem için ayrı sağlayıcı ve model seçebilirsiniz.
          </p>
          <div className="mt-2">
            {TASKS.map(({ task, label, hint }) => (
              <ProviderRow
                key={task}
                label={label}
                hint={hint}
                provider={settings[`${task}Provider` as const]}
                model={settings[`${task}Model` as const]}
                onProviderChange={(value) =>
                  update({ [`${task}Provider`]: value } as Partial<SettingsState>)
                }
                onModelChange={(value) =>
                  update({ [`${task}Model`]: value } as Partial<SettingsState>)
                }
              />
            ))}
          </div>

          {/* Konusma tanima ayni sayfada ayri bir kart olarak duruyordu ama
              o da bir islem saglayicisi secimi; bagimsiz durunca yukaridaki
              ceviri/ozet secimleriyle iliskisi gorunmuyordu. */}
          <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Altyazı (Konuşma Tanıma)
            </p>
            <p className="text-sm text-zinc-500 mt-1 mb-3">
              Konuşma tanıma API&apos;si olan modeller ile videonun sesi metine
              çevirilir. Altyazının çevirisi yukarıdaki <b>Çeviri</b> ayarını
              kullanır.
            </p>
            <select
              value={settings.transcribeModel}
              onChange={(e) => update({ transcribeModel: e.target.value })}
              className={selectClass}
            >
              {TRANSCRIBE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.hint ? ` — ${m.hint}` : ""}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card>
          <CardTitle>API Anahtarları</CardTitle>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Anahtarlar burada tek yerden yönetilir; yukarıdaki her işlem
            seçtiği sağlayıcının anahtarını kullanır.
          </p>
          <div className="space-y-4">
            <Input
              id="openaiKey"
              label="OpenAI API Key"
              type="password"
              placeholder="sk-..."
              value={settings.openaiApiKeyEncrypted || ""}
              onChange={(e) => update({ openaiApiKeyEncrypted: e.target.value })}
            />
            <Input
              id="anthropicKey"
              label="Anthropic API Key"
              type="password"
              placeholder="sk-ant-..."
              value={settings.anthropicApiKeyEncrypted || ""}
              onChange={(e) =>
                update({ anthropicApiKeyEncrypted: e.target.value })
              }
            />
          </div>
        </Card>

        {/* Sonuc mesaji butonun solunda: kaydettikten sonra goz zaten orada */}
        <div className="flex items-center justify-end gap-3 flex-wrap">
          {message && (
            <p
              className={`text-sm ${message.includes("Hata") ? "text-red-500" : "text-emerald-500"}`}
            >
              {message}
            </p>
          )}

          <Button type="submit" loading={saving}>
            <Save size={16} /> Kaydet
          </Button>
        </div>
      </form>
    </>
  );
}
