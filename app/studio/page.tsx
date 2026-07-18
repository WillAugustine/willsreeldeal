import { chatGPTSignOutPath } from "../chatgpt-auth";
import { requireStudioOwner } from "../studio-auth";
import StudioForm from "./StudioForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const owner = await requireStudioOwner();

  return (
    <main className="studio-page">
      <header className="studio-header">
        <Link className="brand" href="/" aria-label="Back to Will's Reel Deal">
          <span className="brand__stamp">W</span>
          <span>Will’s Reel Deal<small>the private screening room</small></span>
        </Link>
        <div className="studio-header__actions">
          <span>Signed in as {owner.displayName}</span>
          <Link href="/">View site</Link>
          {!owner.email.endsWith("@local.test") && <a href={chatGPTSignOutPath("/")}>Sign out</a>}
        </div>
      </header>

      <section className="studio-shell">
        <div className="studio-intro">
          <p className="eyebrow"><span /> Will-only territory</p>
          <h1>Feed the <em>Reel Deal.</em></h1>
          <p>Pick the official movie, upload one poster, write what actually mattered, and send it straight to the homepage.</p>
          <div className="studio-intro__note">
            <strong>Poster recipe</strong>
            <span>Use a portrait image near a 2:3 ratio. JPG, PNG, or WebP. Maximum 8 MB.</span>
          </div>
        </div>
        <StudioForm />
      </section>
    </main>
  );
}
