import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "./_components/CreateProjectDialog";

async function getAccessibleProjects(userId: string, role: string) {
  if (role === "ADMIN") {
    return db.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, projectNumber: true, name: true, client: true, location: true, status: true, _count: { select: { signals: true } } },
    });
  }
  const memberships = await db.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        select: { id: true, projectNumber: true, name: true, client: true, location: true, status: true, _count: { select: { signals: true } } },
      },
    },
    orderBy: { project: { name: "asc" } },
  });
  return memberships.map((m) => m.project);
}

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-semibold">MIAS-IO</h1>
        <p className="text-muted-foreground">Sign in to access your projects.</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </main>
    );
  }

  const projects = await getAccessibleProjects(session.userId, session.role);

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <CreateProjectDialog />
        </div>
        {projects.length === 0 ? (
          <p className="text-muted-foreground">
            No projects yet. Click &ldquo;New Project&rdquo; to get started.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
                  <CardHeader>
                    {project.projectNumber && (
                      <p className="text-xs font-mono text-muted-foreground">{project.projectNumber}</p>
                    )}
                    <CardTitle className="text-base">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {[project.client, project.location].filter(Boolean).join(" · ") || "\u00A0"}
                      </p>
                      <span className="text-xs text-muted-foreground">{project._count.signals} signals</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
