import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

type RuntimeEnv = { DB?: D1Database };

async function localUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return null;
  return { displayName: "Will", email: "will@local.test", fullName: "Will" };
}

async function claimOrCheckOwner(user: ChatGPTUser): Promise<boolean> {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) return user.email.endsWith("@local.test");

  await db.prepare(`CREATE TABLE IF NOT EXISTS studio_owner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare("INSERT OR IGNORE INTO studio_owner (id, email, display_name) VALUES (1, ?, ?)")
    .bind(user.email.toLowerCase(), user.displayName)
    .run();
  const owner = await db.prepare("SELECT email FROM studio_owner WHERE id = 1").first<{ email: string }>();
  return owner?.email.toLowerCase() === user.email.toLowerCase();
}

export async function getStudioOwner(): Promise<ChatGPTUser | null> {
  const user = (await getChatGPTUser()) ?? (await localUser());
  if (!user) return null;
  return (await claimOrCheckOwner(user)) ? user : null;
}

export async function requireStudioOwner(): Promise<ChatGPTUser> {
  const user = (await getChatGPTUser()) ?? (await localUser());
  if (!user) redirect(chatGPTSignInPath("/studio"));
  if (!(await claimOrCheckOwner(user))) redirect("/?studio=private");
  return user;
}
