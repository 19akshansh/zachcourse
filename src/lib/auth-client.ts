import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: (import.meta as any).env?.VITE_APP_URL || window.location.origin,
})

export const { signIn, signUp, signOut, useSession } = authClient
