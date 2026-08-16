"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddNoteModal } from "./add-note-modal";
import { Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface NotesHeaderProps {
  title: string;
  showAdd?: boolean;
}

export function NotesHeader({ title, showAdd = true }: NotesHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{title}</h1>

      {/* Arama ve ekleme tek satirda: buton icerigi asagi itmesin */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Notlarda ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>
        {showAdd && (
          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            size="sm"
            className="shrink-0"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Not Ekle</span>
          </Button>
        )}
      </form>

      <AddNoteModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
