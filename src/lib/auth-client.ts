import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : ((import.meta as any).env.VITE_APP_URL || ""),
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem("session_token") || "",
    }
  }
})

export const { signIn, signUp, signOut, useSession } = authClient
