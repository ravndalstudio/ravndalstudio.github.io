# Markdown for Agents (content negotiation)

Agents can request clean Markdown instead of full HTML by sending:

```http
Accept: text/markdown
```

Browsers and crawlers that do not send that header continue to receive HTML.

References:

- [Markdown for Agents (Cloudflare)](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Markdown negotiation skill](https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md)

This site is served from GitHub Pages with **Cloudflare** in front (`www.ravndalstudio.com`). Content negotiation must happen at the edge, not in static files.

## Option A — Cloudflare Markdown for Agents (recommended)

If your zone is on **Pro, Business, or Enterprise**, enable the built-in converter (no app code):

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and select the `ravndalstudio.com` zone.
2. Go to **AI Crawl Control** (or **Security** → **AI Crawl Control**, depending on UI).
3. Turn on **Markdown for Agents**.

API (zone settings edit permission):

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_tag}/settings/content_converter" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer {api_token}" \
  --data-raw '{"value":"on"}'
```

Do **not** deploy the Worker in Option B if this setting is enabled (you only need one conversion path).

## Option B — Cloudflare Worker (any plan)

The repo includes `workers/markdown-for-agents/`, which converts HTML responses when `Accept: text/markdown` is present.

```bash
cd workers/markdown-for-agents
npm install
npx wrangler login
npm run deploy
```

Update `routes` in `wrangler.toml` if hostnames or zone name differ.

## Validate

```bash
curl -sI "https://www.ravndalstudio.com/" -H "Accept: text/markdown" | grep -i content-type
# Expect: content-type: text/markdown; charset=utf-8
```

PowerShell:

```powershell
.\scripts\validate-markdown-negotiation.ps1
```

Agent readiness scan:

```bash
curl -s -X POST "https://isitagentready.com/api/scan" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.ravndalstudio.com/"}'
```

Look for `checks.contentAccessibility.markdownNegotiation.status` = `"pass"`.

## Content signals

`robots.txt` already declares a [Content Signals](https://contentsignals.org/) policy. Markdown responses inherit cache and security headers from the origin where possible; the Worker adds `Vary: Accept` so HTML and Markdown are cached separately.
