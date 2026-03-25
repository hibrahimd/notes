import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/card";
import { FileText, Users, AlertTriangle, CheckCircle } from "lucide-react";

export default async function AdminDashboard() {
  const [userCount, noteCount, failedNotes, readyNotes] = await Promise.all([
    prisma.user.count(),
    prisma.note.count(),
    prisma.note.count({ where: { status: "failed" } }),
    prisma.note.count({ where: { status: "ready" } }),
  ]);

  const stats = [
    { label: "Kullanıcılar", value: userCount, icon: Users, color: "text-blue-500" },
    { label: "Toplam Not", value: noteCount, icon: FileText, color: "text-zinc-600" },
    { label: "Hazır", value: readyNotes, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Hatalı", value: failedNotes, icon: AlertTriangle, color: "text-red-500" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="flex items-center gap-3">
                <Icon size={24} className={stat.color} />
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
