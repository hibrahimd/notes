"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Link2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

interface AddNoteModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddNoteModal({ open, onClose }: AddNoteModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"link" | "text">("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = {};
      if (tab === "link") {
        if (!url) { setError("Link gerekli"); setLoading(false); return; }
        body.sourceUrl = url;
        if (title) body.title = title;
      } else {
        if (!text) { setError("Metin gerekli"); setLoading(false); return; }
        body.text = text;
        if (title) body.title = title;
      }

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Hata oluştu");
        return;
      }

      // Ayni icerik zaten kayitliysa yeni not acilmiyor; sessizce kapanmak
      // yerine kullaniciyi notuna goturuyoruz
      if (data.duplicate && data.note?.id) {
        onClose();
        router.push(`/dashboard/notes/${data.note.id}`);
        return;
      }

      setUrl("");
      setText("");
      setTitle("");
      onClose();
      router.refresh();
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg mx-4 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Not Ekle</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setTab("link")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "link"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Link2 size={16} /> Link
            </button>
            <button
              onClick={() => setTab("text")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "text"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <FileText size={16} /> Metin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "link" && (
              <Input
                id="url"
                label="URL"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
            )}

            {tab === "text" && (
              <Textarea
                id="text"
                label="Metin"
                placeholder="Notunuzu yazın..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                autoFocus
              />
            )}

            <Input
              id="title"
              label="Başlık (opsiyonel)"
              placeholder="Not başlığı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                İptal
              </Button>
              <Button type="submit" loading={loading}>
                Kaydet
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
