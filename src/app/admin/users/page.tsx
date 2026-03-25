"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserItem {
  id: string;
  email: string;
  role: string;
  preferredLanguage: string;
  createdAt: string;
  _count: { notes: number };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-zinc-400">Yükleniyor...</div>;
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Kullanıcılar</h1>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left p-4 font-medium text-zinc-500">Email</th>
              <th className="text-left p-4 font-medium text-zinc-500">Rol</th>
              <th className="text-left p-4 font-medium text-zinc-500">Notlar</th>
              <th className="text-left p-4 font-medium text-zinc-500">Dil</th>
              <th className="text-left p-4 font-medium text-zinc-500">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <td className="p-4 text-zinc-900 dark:text-zinc-100">{user.email}</td>
                <td className="p-4">
                  <Badge variant={user.role === "admin" ? "warning" : "default"}>
                    {user.role}
                  </Badge>
                </td>
                <td className="p-4 text-zinc-600 dark:text-zinc-400">{user._count.notes}</td>
                <td className="p-4 text-zinc-600 dark:text-zinc-400">{user.preferredLanguage}</td>
                <td className="p-4 text-zinc-400">{new Date(user.createdAt).toLocaleDateString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
