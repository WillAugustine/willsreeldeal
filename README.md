# Will's Reel Deal

Will's Reel Deal is a playful, ad-light movie review site built with Next.js,
Vinext, and Cloudflare Workers.

## What runs where

- GitHub is the source of truth for the code.
- Cloudflare Workers serves the website.
- Cloudflare D1 stores reviews, newsletter signups, and movie requests.
- Cloudflare R2 stores poster uploads.
- Squarespace remains the domain registrar for `willsreeldeal.com`.
- Cloudflare Access protects the private review studio at `/studio`.

The public site does not depend on ChatGPT or OpenAI hosting.

## Local development

Requirements:

- Node.js 22.13 or newer

Install and run:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm test
npm run lint
npm run deploy
```

Local development uses local D1 and R2 data under `.wrangler`. The studio is
available locally without Cloudflare Access.

## Cloudflare configuration

`wrangler.jsonc` defines the Worker, D1 database, and R2 bucket bindings. The
production Worker also needs a `STUDIO_OWNER_EMAIL` environment variable.
Cloudflare Access must protect both `/studio` and `/studio/*`, allowing only the
owner email.

Deployments are connected to the `WillAugustine/willsreeldeal` GitHub repository
so a push to `main` can publish the latest verified version.

## Publishing a review

1. Open `https://willsreeldeal.com/studio`.
2. Sign in through Cloudflare Access.
3. Search for and select the movie.
4. Add the genre, runtime, Will-o-Meter score, quick take, and full review.
5. Upload a JPG, PNG, or WebP poster under 8 MB.
6. Select `Publish the take`.

The review appears on the homepage immediately.
