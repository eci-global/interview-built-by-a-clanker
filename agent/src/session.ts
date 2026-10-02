import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SessionUser = {
  id: string;
  email: string;
  username?: string;
};

export type Session = {
  token: string;
  user: SessionUser;
};

const sessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".session.json",
);

let session: Session | null = readSession();

function readSession(): Session | null {
  if (!existsSync(sessionPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(sessionPath, "utf8")) as Session;
    if (!parsed?.token || !parsed.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSession() {
  return session;
}

export function setSession(next: Session) {
  session = next;
  writeFileSync(sessionPath, JSON.stringify(next, null, 2));
}

export function clearSession() {
  session = null;
  if (existsSync(sessionPath)) unlinkSync(sessionPath);
}
