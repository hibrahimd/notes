"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  FileText,
  Star,
  Archive,
  Settings,
  Share2,
  Link2,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  role: string;
}

const userMenuItems = [
  { href: "/dashboard", label: "Inbox", icon: Inbox },
  { href: "/dashboard/notes", label: "Tüm Notlar", icon: FileText },
  { href: "/dashboard/favorites", label: "Favoriler", icon: Star },
  { href: "/dashboard/archive", label: "Arşiv", icon: Archive },
  { href: "/dashboard/shared", label: "Paylaşılan", icon: Share2 },
];

const userSettingsItems = [
  { href: "/dashboard/settings", label: "Ayarlar", icon: Settings },
  { href: "/dashboard/shortcut", label: "Kısayollar", icon: Link2 },
];

const adminMenuItems = [
  { href: "/admin", label: "Dashboard", icon: Shield },
  { href: "/admin/users", label: "Kullanıcılar", icon: FileText },
  { href: "/admin/settings", label: "Sistem Ayarları", icon: Settings },
  { href: "/admin/email", label: "Email Ayarları", icon: Inbox },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = role === "admin";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const navContent = (
    <>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 font-bold text-sm">N</span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Not Al</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">Notlar</p>
        {userMenuItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">Hesap</p>
          {userSettingsItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="pt-4">
            <p className="px-3 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">Admin</p>
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50 w-full transition-colors"
        >
          <LogOut size={18} />
          Çıkış Yap
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobil ust bar akisin icinde duruyor (fixed degil): boylece sayfa
          basligi asla altina girmiyor ve kaydirinca uzerine binmiyor */}
      <div className="lg:hidden shrink-0 h-14 flex items-center gap-2 px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
          className="p-2 -ml-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Not Al</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
