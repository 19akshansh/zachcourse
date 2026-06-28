export function navigate(to: string) {
  window.location.href = to
}

export function usePath() {
  return window.location.pathname
}
