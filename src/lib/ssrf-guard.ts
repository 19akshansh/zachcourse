import { URL } from "url";

const BLOCKED_HOSTS = [
  "169.254.169.254",
  "metadata.google.internal",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
];

// RFC-1918 Private IP Ranges and typical loopbacks
const PRIVATE_IP_REGEXP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

/**
 * Checks if a URL is blocked to prevent Server-Side Request Forgery (SSRF).
 * Blocks metadata service IPs, private ranges (RFC-1918), and localhost loopbacks.
 * Only permits http: and https: protocols.
 */
export function isBlockedUrl(urlString: string): boolean {
  try {
    const parsedUrl = new URL(urlString);
    
    // Only support HTTP and HTTPS protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return true;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Check against direct blocked hosts list
    if (BLOCKED_HOSTS.includes(hostname)) {
      return true;
    }

    // Check if the host resolves to a private IP pattern
    if (PRIVATE_IP_REGEXP.test(hostname)) {
      return true;
    }

    return false;
  } catch (err) {
    // If the URL is completely malformed, block it by default
    return true;
  }
}
