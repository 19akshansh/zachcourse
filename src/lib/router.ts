import { useState, useEffect } from "react";

// Set of subscribers for router navigation
const listeners = new Set<(path: string) => void>();

export function navigate(to: string) {
  if (typeof window !== "undefined") {
    if (to.startsWith("/") && !to.startsWith("//")) {
      window.history.pushState(null, "", to);
      listeners.forEach((listener) => listener(to));
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      window.location.href = to;
    }
  }
}

export function usePath() {
  const [path, setPath] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setPath(window.location.pathname);
    };

    const handleCustomNavigate = (newPath: string) => {
      setPath(newPath.split("?")[0]);
    };

    window.addEventListener("popstate", handlePopState);
    listeners.add(handleCustomNavigate);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      listeners.delete(handleCustomNavigate);
    };
  }, []);

  return path;
}
