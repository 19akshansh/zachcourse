import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBlockedUrl, isPrivateOrBlockedIp, isBlockedUrlResolved } from "../ssrf-guard";
import dns from "dns";

vi.mock("dns", () => {
  return {
    default: {
      promises: {
        lookup: vi.fn(),
      },
    },
  };
});

describe("ssrf-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isBlockedUrl", () => {
    it("should block metadata URL", () => {
      expect(isBlockedUrl("http://169.254.169.254/")).toBe(true);
    });

    it("should block localhost URL", () => {
      expect(isBlockedUrl("http://localhost:3000")).toBe(true);
      expect(isBlockedUrl("http://127.0.0.1")).toBe(true);
    });

    it("should block private ranges based on string pattern", () => {
      expect(isBlockedUrl("http://10.0.0.5")).toBe(true);
      expect(isBlockedUrl("http://192.168.1.1")).toBe(true);
    });

    it("should permit safe external URLs", () => {
      expect(isBlockedUrl("https://example.com")).toBe(false);
    });

    it("should block malformed URLs", () => {
      expect(isBlockedUrl("not-a-url")).toBe(true);
    });
  });

  describe("isPrivateOrBlockedIp", () => {
    it("should correctly identify private and loopback IPs", () => {
      expect(isPrivateOrBlockedIp("127.0.0.1")).toBe(true);
      expect(isPrivateOrBlockedIp("10.1.2.3")).toBe(true);
      expect(isPrivateOrBlockedIp("192.168.5.5")).toBe(true);
      expect(isPrivateOrBlockedIp("172.16.0.10")).toBe(true);
      expect(isPrivateOrBlockedIp("172.31.255.255")).toBe(true);
      expect(isPrivateOrBlockedIp("172.32.0.1")).toBe(false); // Outside private range
      expect(isPrivateOrBlockedIp("8.8.8.8")).toBe(false);
      expect(isPrivateOrBlockedIp("::1")).toBe(true);
      expect(isPrivateOrBlockedIp("fe80::1")).toBe(true);
      expect(isPrivateOrBlockedIp("fc00::abc")).toBe(true);
    });
  });

  describe("isBlockedUrlResolved", () => {
    it("should block if hostname resolves to a private IP", async () => {
      vi.spyOn(dns.promises, "lookup").mockResolvedValue([
        { address: "10.0.0.1", family: 4 }
      ] as any);

      const result = await isBlockedUrlResolved("https://attacker.com");
      expect(result).toBe(true);
    });

    it("should allow if hostname resolves to a public IP", async () => {
      vi.spyOn(dns.promises, "lookup").mockResolvedValue([
        { address: "93.184.216.34", family: 4 }
      ] as any);

      const result = await isBlockedUrlResolved("https://example.com");
      expect(result).toBe(false);
    });

    it("should block if DNS resolution fails", async () => {
      vi.spyOn(dns.promises, "lookup").mockRejectedValue(new Error("DNS Error"));

      const result = await isBlockedUrlResolved("https://some-broken-domain.invalid");
      expect(result).toBe(true);
    });
  });
});
