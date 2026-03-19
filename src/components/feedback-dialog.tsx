"use client";

import { useState, useRef } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, ExternalLink, Camera, Paperclip, X, Loader2 } from "lucide-react";

type FeedbackType = "Bug" | "User Story" | "Task";
type Attachment = { fileName: string; base64: string; preview?: string };

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Send feedback"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </Button>
      {open && <FeedbackDialog open onClose={() => setOpen(false)} />}
    </>
  );
}

async function captureScreenshot(): Promise<Attachment | null> {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(document.body, {
      scale: 1,
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    return {
      fileName: `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      base64,
      preview: dataUrl,
    };
  } catch {
    return null;
  }
}

function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      const isImage = file.type.startsWith("image/");
      resolve({
        fileName: file.name,
        base64,
        preview: isImage ? dataUrl : undefined,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>("Bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<{ id: number; url?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: (data) => setResult(data),
  });

  function handleSubmit() {
    if (!title.trim()) return;
    submit.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      pageUrl: window.location.href,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
      attachments: attachments.map(({ fileName, base64 }) => ({ fileName, base64 })),
    });
  }

  async function handleScreenshot() {
    setCapturing(true);
    const att = await captureScreenshot();
    if (att) setAttachments((prev) => [...prev, att]);
    setCapturing(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) continue; // skip >10MB
      const att = await fileToAttachment(file);
      setAttachments((prev) => [...prev, att]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleClose() {
    if (submit.isPending) return;
    setType("Bug");
    setTitle("");
    setDescription("");
    setAttachments([]);
    setResult(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-green-600 font-medium">
              Created work item #{result.id}
            </p>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                Open in Azure DevOps
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug Report</SelectItem>
                  <SelectItem value="User Story">Feature Request</SelectItem>
                  <SelectItem value="Task">Task / Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "Bug" ? "What went wrong?"
                    : type === "User Story" ? "What would you like?"
                    : "What do you need?"
                }
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && title.trim()) handleSubmit();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Steps to reproduce, expected behavior, or any additional context..."
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleScreenshot}
                  disabled={capturing}
                >
                  {capturing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                  Screenshot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  Attach file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt,.log,.csv"
                  multiple
                  onChange={handleFileChange}
                />
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group">
                      {att.preview ? (
                        <img
                          src={att.preview}
                          alt={att.fileName}
                          className="h-16 w-auto rounded border object-cover"
                        />
                      ) : (
                        <div className="h-16 px-3 flex items-center rounded border bg-muted/30 text-xs text-muted-foreground">
                          <Paperclip className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                          <span className="truncate max-w-[100px]">{att.fileName}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submit.error && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {submit.error.message}
              </p>
            )}

            <p className="text-[11px] text-muted-foreground">
              Current page URL, app version, and your email will be attached automatically.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={submit.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!title.trim() || submit.isPending}>
                {submit.isPending ? "Submitting..." : `Submit${attachments.length > 0 ? ` (${attachments.length} file${attachments.length > 1 ? "s" : ""})` : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
