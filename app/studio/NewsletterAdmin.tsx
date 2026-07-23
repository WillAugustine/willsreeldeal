"use client";

import { useEffect, useState } from "react";

type NewsletterStatus = {
  apiKeyConfigured: boolean;
  connected: boolean;
  sender: string;
  subscribers: {
    total: number;
    instant: number;
    biweekly: number;
  };
};

export default function NewsletterAdmin() {
  const [status, setStatus] = useState<NewsletterStatus | null>(null);
  const [message, setMessage] = useState("Checking the mailroom...");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetch("/studio/api/newsletter")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not check Reel Mail.");
        setStatus(data);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not check Reel Mail."));
  }, []);

  async function connect() {
    setWorking(true);
    setMessage("Organizing the mailroom...");
    try {
      const response = await fetch("/studio/api/newsletter", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect Reel Mail.");
      setStatus(data);
      setMessage(`Reel Mail is connected. ${data.synced} saved ${data.synced === 1 ? "subscriber is" : "subscribers are"} synced.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect Reel Mail.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="studio-newsletter">
      <div>
        <p className="kicker">02 - The mailroom</p>
        <h2>Reel Mail</h2>
        <p>New-review notes go out when you publish. The Double Feature Digest runs every other Friday.</p>
      </div>
      <div className="studio-newsletter__status">
        <span className={status?.connected ? "status-dot status-dot--live" : "status-dot"} />
        <div>
          <strong>{status?.connected ? "Connected" : "Needs connection"}</strong>
          <small>{status?.sender || "Sender not configured"}</small>
        </div>
        <dl>
          <div><dt>Total</dt><dd>{status?.subscribers.total ?? 0}</dd></div>
          <div><dt>Instant</dt><dd>{status?.subscribers.instant ?? 0}</dd></div>
          <div><dt>Digest</dt><dd>{status?.subscribers.biweekly ?? 0}</dd></div>
        </dl>
        <button className="button button--lime" type="button" onClick={connect} disabled={working || !status?.apiKeyConfigured}>
          {working ? "Connecting..." : status?.connected ? "Sync subscribers" : "Connect Reel Mail"}
        </button>
        {!status?.apiKeyConfigured && status && <p>Add the Resend key in Cloudflare to unlock this button.</p>}
        {message && <p aria-live="polite">{message}</p>}
      </div>
    </section>
  );
}
