import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type StudioUser = {
  displayName: string;
  email: string;
};

type RuntimeEnv = { STUDIO_OWNER_EMAIL?: string };

async function localUser(): Promise<StudioUser | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) return null;
  return { displayName: "Will", email: "will@local.test" };
}

export async function getStudioOwner(): Promise<StudioUser | null> {
  const local = await localUser();
  if (local) return local;

  const requestHeaders = await headers();
  const email = requestHeaders
    .get("cf-access-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  const ownerEmail = (env as unknown as RuntimeEnv).STUDIO_OWNER_EMAIL
    ?.trim()
    .toLowerCase();

  if (!email || !ownerEmail || email !== ownerEmail) return null;
  return { displayName: "Will", email };
}

export async function requireStudioOwner(): Promise<StudioUser> {
  const owner = await getStudioOwner();
  if (!owner) redirect("/?studio=private");
  return owner;
}
