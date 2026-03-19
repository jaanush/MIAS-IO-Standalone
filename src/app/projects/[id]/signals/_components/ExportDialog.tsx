"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Archive, Loader2 } from "lucide-react";
import JSZip from "jszip";

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string) {
  downloadBlob(new Blob([content], { type: "text/plain" }), filename);
}

export function ExportLegacyDialog({ projectId, open, onClose }: Props) {
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: files, isLoading } = trpc.export.legacyFiles.useQuery(
    { projectId },
    { enabled: open }
  );

  const allFiles = trpc.export.legacyAllFiles.useQuery(
    { projectId },
    { enabled: false } // only fetch on demand
  );

  async function handleDownloadFile(filename: string) {
    const result = await allFiles.refetch();
    const file = result.data?.find((f) => f.name === filename);
    if (file) downloadText(file.content, file.name);
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      const result = await allFiles.refetch();
      if (!result.data) return;

      const zip = new JSZip();
      for (const file of result.data) {
        zip.file(file.name, file.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `mias-legacy-export-project-${projectId}.zip`);
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export MIAS Legacy</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          GVL declarations, alarm handling, analog scaling, Modbus I/O mapping,
          and logging code in CODESYS / METS_Lib format.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Generating...</span>
          </div>
        ) : files && files.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-md border divide-y max-h-[50vh] overflow-y-auto">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between px-3 py-2 hover:bg-accent/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-mono truncate">{f.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {f.lines} lines &middot; {(f.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDownloadFile(f.name)}
                    title={`Download ${f.name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-muted-foreground">
                {files.length} file{files.length !== 1 ? "s" : ""}
              </span>
              <Button onClick={handleDownloadAll} disabled={downloadingAll}>
                {downloadingAll ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Zipping...</>
                ) : (
                  <><Archive className="h-4 w-4 mr-1.5" /> Download All (.zip)</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            No files generated. Make sure signals have tags assigned.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
