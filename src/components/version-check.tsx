"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
const CHECK_INTERVAL = 60_000; // 1 minute

export function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data.version && data.version !== CLIENT_VERSION) {
          setServerVersion(data.version);
          setUpdateAvailable(true);
        }
      } catch {
        // Ignore — server might be restarting
      }
    }

    // First check after 10s (let the page settle)
    const initial = setTimeout(check, 10_000);
    const interval = setInterval(check, CHECK_INTERVAL);

    return () => {
      mounted = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors animate-in fade-in slide-in-from-bottom-4"
    >
      <RefreshCw className="h-4 w-4" />
      New version {serverVersion} available — click to reload
    </button>
  );
}
