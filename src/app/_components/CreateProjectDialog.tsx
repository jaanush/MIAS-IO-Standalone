"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");

  const create = trpc.project.create.useMutation({
    onSuccess: (project) => {
      setOpen(false);
      setName("");
      setProjectNumber("");
      setClient("");
      setLocation("");
      router.push(`/projects/${project.id}`);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({
              name: name.trim(),
              projectNumber: projectNumber.trim() || undefined,
              client: client.trim() || undefined,
              location: location.trim() || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-number">Project Number</Label>
            <Input
              id="project-number"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="e.g. 25425-852"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-client">Client</Label>
            <Input
              id="project-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-location">Location</Label>
            <Input
              id="project-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
