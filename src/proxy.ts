import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, readSessionSeal } from "@/lib/session-seal";

/**
 * Next.js 16'da `middleware` konvansiyonu `proxy` olarak yeniden adlandirildi.
 *
 * Buradaki kontrol ilk savunma hattidir; yetkilendirmenin asil yeri hala
 * layout'lardaki requireAuth/requireAdmin ve route handler'lardaki oturum
 * kontrolleridir. Onemli fark: artik cerezin yalnizca varligina degil,
 * muhrunun gecerliligine bakiliyor.
 */

const publicPaths = [
  "/login",
  "/share",
  "/api/auth",
  "/api/ingest",
  "/api/shortcut",
  "/shortcut/setup",
];

function isPublic(pathname: string): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const seal = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionSeal(seal);

  if (session) {
    return NextResponse.next();
  }

  // Ana sayfa oturumsuz da gorulebilir
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  if (seal) {
    // Bozuk ya da suresi dolmus cerezi temizle, yoksa login'e her seferinde
    // ayni gecersiz cerezle geri donulur
    response.cookies.delete(SESSION_COOKIE_NAME);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
