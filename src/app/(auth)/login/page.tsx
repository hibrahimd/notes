"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

type Step = "email" | "code" | "admin-password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes("Admin")) {
          setStep("admin-password");
          setError("");
        } else {
          setError(data.error);
        }
      } else {
        setMessage(data.message);
        setStep("code");
      }
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        if (data.user.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 font-bold text-lg">N</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Not Al</h1>
            <p className="text-sm text-zinc-500">Giriş yap</p>
          </div>
        </div>

        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Devam Et
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {message && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                {message}
              </p>
            )}
            <Input
              id="code"
              label="Doğrulama Kodu"
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Giriş Yap
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(""); setMessage(""); }}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 w-full text-center"
            >
              Farklı email ile giriş yap
            </button>
          </form>
        )}

        {step === "admin-password" && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <p className="text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
              Admin hesabı tespit edildi. Şifrenizi girin.
            </p>
            <Input
              id="password"
              label="Şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Giriş Yap
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(""); }}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 w-full text-center"
            >
              Farklı email ile giriş yap
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
