import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL || window.location.origin,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem("session_token") || "",
    }
  }
})

export const { signIn, signUp, signOut, useSession } = authClient
