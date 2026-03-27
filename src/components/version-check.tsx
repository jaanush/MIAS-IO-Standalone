"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
const CHECK_INTERVAL = 30_000; // 30 seconds

type Status = "current" | "deploy-pending" | "update-available";

export function VersionCheck() {
  const [status, setStatus] = useState<Status>("current");
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [deployMessage, setDeployMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;

        if (data.version && data.version !== CLIENT_VERSION) {
          setServerVersion(data.version);
          setStatus("update-available");
        } else if (data.deployPending) {
          setDeployMessage(data.deployMessage ?? "A new version is being deployed.");
          setStatus("deploy-pending");
        } else {
          // Only reset if we haven't already seen an update
          if (status === "deploy-pending" || status === "current") {
            setStatus("current");
          }
        }
      } catch {
        // Server might be restarting during deploy
      }
    }

    const initial = setTimeout(check, 5_000);
    const interval = setInterval(check, CHECK_INTERVAL);

    return () => {
      mounted = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [status]);

  if (status === "current") return null;

  if (status === "deploy-pending") {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-4">
        <AlertTriangle className="h-4 w-4" />
        {deployMessage}
      </div>
    );
  }

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
