export const PLACEHOLDER_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "placeholder.com",
  "test.com",
  "yourdomain.com",
  "domain.com",
  "site.com",
  "foo.com",
  "bar.com"
];

/**
 * Sanitizes a resource URL. Returns a safe, guaranteed-real Google Search query URL
 * if the input is missing, malformed, or resides on a known placeholder/dummy domain.
 */
export function sanitizeResourceUrl(url: string | undefined | null, title: string, type: string): string {
  const query = `${title} ${type}`.trim();
  const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  if (!url) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallbackUrl;
    }

    const hostname = parsed.hostname.toLowerCase();
    const isPlaceholder = PLACEHOLDER_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith("." + domain)
    );

    if (isPlaceholder) {
      return fallbackUrl;
    }

    return url;
  } catch (e) {
    return fallbackUrl;
  }
}
