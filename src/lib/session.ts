import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionSecret } from "./env";
import { SESSION_COOKIE_NAME, type SessionData } from "./session-seal";

export type { SessionData };
export { SESSION_COOKIE_NAME, readSessionSeal } from "./session-seal";

/**
 * Sir, modul yuklenirken degil ilk kullanimda okunur; boylece `next build`
 * sirasinda ortam degiskeni olmadan da derleme yapilabilir, ama calisma
 * aninda eksikse acik bir hata verilir.
 */
export function getSessionOptions() {
  return {
    password: getSessionSecret(),
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 7 gun
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}
