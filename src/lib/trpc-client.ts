import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/trpc.js";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      // CRITICAL: send cookies with every tRPC request
      // Without this, Better Auth session is never read
      fetch: (url, options) => {
        const token = localStorage.getItem("session_token");
        const headers = new Headers(options?.headers || {});
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return window.fetch(url, {
          ...options,
          credentials: "include",
          headers,
        });
      },
      headers: () => ({
        "x-trpc-source": "react",
      }),
    }),
  ],
});
