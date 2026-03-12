import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/routers/_app";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

function parseCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="))
    ?.slice(name.length + 1);
}

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async ({ req }) => {
      const cookieHeader = req.headers.get("cookie") ?? "";
      const token = parseCookie(cookieHeader, SESSION_COOKIE);
      const session = token ? await verifySessionToken(token) : null;
      return { session };
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `tRPC error on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
