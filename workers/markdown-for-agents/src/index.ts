import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export default {
  async fetch(request: Request): Promise<Response> {
    if (!wantsMarkdown(request)) {
      return fetch(request);
    }

    const originResponse = await fetch(request);
    if (!originResponse.ok) {
      return originResponse;
    }

    const contentType = originResponse.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html")) {
      return originResponse;
    }

    const contentLength = originResponse.headers.get("Content-Length");
    if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
      return originResponse;
    }

    const html = await originResponse.text();
    if (html.length > MAX_HTML_BYTES) {
      return originResponse;
    }

    const markdown = convertHtmlToMarkdown(html);
    const headers = buildMarkdownHeaders(originResponse.headers, markdown);

    return new Response(markdown, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    });
  },
};

function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  return /\btext\/markdown\b/i.test(accept);
}

function escapeYaml(value: string): string {
  if (/[:#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function convertHtmlToMarkdown(html: string): string {
  const { document } = parseHTML(html);

  for (const el of document.querySelectorAll("script, style, noscript")) {
    el.remove();
  }

  const title =
    document.querySelector("title")?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim();
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ||
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content")
      ?.trim();
  const image =
    document.querySelector('meta[property="og:image"]')?.getAttribute("content")?.trim();

  const contentRoot =
    document.querySelector("#main") ??
    document.querySelector("main") ??
    document.querySelector("article") ??
    document.body;

  for (const el of contentRoot.querySelectorAll("script, style, header, footer, nav")) {
    el.remove();
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  let bodyMarkdown = turndown.turndown(contentRoot.innerHTML).trim();

  const jsonLdBlocks: string[] = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = script.textContent?.trim();
    if (raw) {
      jsonLdBlocks.push(raw);
    }
  }

  const parts: string[] = [];
  const frontmatterFields: string[] = [];
  if (title) {
    frontmatterFields.push(`title: ${escapeYaml(title)}`);
  }
  if (description) {
    frontmatterFields.push(`description: ${escapeYaml(description)}`);
  }
  if (image) {
    frontmatterFields.push(`image: ${escapeYaml(image)}`);
  }

  if (frontmatterFields.length > 0) {
    parts.push("---", ...frontmatterFields, "---", "");
  }

  parts.push(bodyMarkdown);

  if (jsonLdBlocks.length > 0) {
    parts.push("", "```json", jsonLdBlocks.join("\n"), "```");
  }

  return parts.join("\n");
}

function buildMarkdownHeaders(
  originHeaders: Headers,
  markdown: string,
): Headers {
  const headers = new Headers(originHeaders);

  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("x-markdown-tokens", String(estimateTokens(markdown)));

  const vary = headers.get("Vary");
  headers.set("Vary", vary ? `${vary}, Accept` : "Accept");

  headers.delete("Content-Encoding");
  headers.delete("Content-Range");
  headers.delete("Transfer-Encoding");
  headers.delete("ETag");
  headers.delete("Last-Modified");

  return headers;
}
