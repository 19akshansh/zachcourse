import { URL } from "url";
import dns from "dns";

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

/**
 * Validates an IP address string to check if it falls under loopback, link-local, private RFC-1918, or private IPv6.
 */
export function isPrivateOrBlockedIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase();

  // IPv4 Loopback (127.0.0.0/8)
  if (cleanIp.startsWith("127.")) {
    return true;
  }

  // IPv4 Link-local (169.254.0.0/16)
  if (cleanIp.startsWith("169.254.")) {
    return true;
  }

  // IPv4 RFC-1918 Private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (cleanIp.startsWith("10.") || cleanIp.startsWith("192.168.")) {
    return true;
  }
  const parts = cleanIp.split(".");
  if (parts.length === 4) {
    const secondOctet = parseInt(parts[1], 10);
    if (parts[0] === "172" && secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  // IPv4 0.0.0.0 (any)
  if (cleanIp === "0.0.0.0") {
    return true;
  }

  // IPv6 Loopback (::1)
  if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv6 Link-local (fe80::/10)
  if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) {
    return true;
  }

  // IPv6 Unique Local Address (fc00::/7)
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) {
    return true;
  }

  return false;
}

/**
 * Performs DNS resolution using dns.promises.lookup() to check all resolved IPs
 * against loopback, private, and link-local ranges.
 */
export async function isBlockedUrlResolved(urlString: string): Promise<boolean> {
  // First, apply the fast string-based check
  if (isBlockedUrl(urlString)) {
    return true;
  }

  try {
    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Retrieve all IPv4 and IPv6 addresses
    const lookupResult = await dns.promises.lookup(hostname, { all: true });

    for (const entry of lookupResult) {
      if (isPrivateOrBlockedIp(entry.address)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    // If resolution fails or URL is malformed, block it by default
    return true;
  }
}
