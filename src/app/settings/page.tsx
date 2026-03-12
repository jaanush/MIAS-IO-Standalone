import { getSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getSession();

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Account</p>
          <p className="mt-1 text-sm text-muted-foreground">{session?.email}</p>
          <p className="text-xs text-muted-foreground">{session?.role}</p>
        </div>
      </div>
    </main>
  );
}
