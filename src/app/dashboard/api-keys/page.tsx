"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Check } from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadKeys() {
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys || []);
        setLoading(false);
      });
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName) return;
    setCreating(true);

    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });

    const data = await res.json();
    if (res.ok) {
      setNewKey(data.key);
      setNewKeyName("");
      loadKeys();
    }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu API anahtarını silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    loadKeys();
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return <div className="text-zinc-400">Yükleniyor...</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">API Anahtarları</h1>
        <Button onClick={() => { setShowCreate(true); setNewKey(null); }} size="sm">
          <Plus size={16} /> Yeni Anahtar
        </Button>
      </div>

      {newKey && (
        <Card className="mb-6 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-2">
            API anahtarınız oluşturuldu! Bu anahtarı kaydedin, tekrar gösterilmeyecektir.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg break-all">
              {newKey}
            </code>
            <Button variant="outline" size="sm" onClick={copyKey}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </Card>
      )}

      {showCreate && !newKey && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                id="keyName"
                label="Anahtar Adı"
                placeholder="iPhone Shortcut, Test vb."
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" loading={creating}>Oluştur</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>İptal</Button>
          </form>
        </Card>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-lg">Henüz API anahtarı yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <Card key={key.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{key.name}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                  <code>{key.keyPrefix}••••••••</code>
                  <span>Oluşturulma: {new Date(key.createdAt).toLocaleDateString("tr-TR")}</span>
                  {key.lastUsedAt && (
                    <span>Son kullanım: {new Date(key.lastUsedAt).toLocaleDateString("tr-TR")}</span>
                  )}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleDelete(key.id)}>
                <Trash2 size={16} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
