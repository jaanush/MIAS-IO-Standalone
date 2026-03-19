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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, ExternalLink } from "lucide-react";

type FeedbackType = "Bug" | "User Story" | "Task";

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

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>("Bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{ id: number; url?: string } | null>(null);

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
    });
  }

  function handleClose() {
    if (submit.isPending) return;
    setType("Bug");
    setTitle("");
    setDescription("");
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
                  type === "Bug"
                    ? "What went wrong?"
                    : type === "User Story"
                    ? "What would you like?"
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
                {submit.isPending ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
