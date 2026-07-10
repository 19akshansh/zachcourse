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
        const userKey = localStorage.getItem("zc_user_key");
        const headers = new Headers(options?.headers || {});
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        if (userKey && userKey !== "null" && userKey !== "undefined" && userKey.trim() !== "") {
          headers.set("x-user-key", userKey.trim());
        }
        return window.fetch(url, {
          ...options,
          credentials: "include",
          headers,
        });
      },
      headers: () => {
        let userKey = localStorage.getItem("zc_user_key");
        if (userKey === "null" || userKey === "undefined") userKey = null;
        return {
          "x-trpc-source": "react",
          ...(userKey ? { "x-user-key": userKey } : {}),
        };
      },
    }),
  ],
});
