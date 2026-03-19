import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const AZURE_ORG = "metstechnology";
const AZURE_PROJECT = "MIAS-IO";
const API_VERSION = "7.1";

const WORK_ITEM_TYPES = ["Bug", "User Story", "Task"] as const;

export const feedbackRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(
      z.object({
        type: z.enum(WORK_ITEM_TYPES),
        title: z.string().min(1).max(255),
        description: z.string().max(5000).optional(),
        pageUrl: z.string().optional(),
        appVersion: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pat = process.env.AZURE_DEVOPS_PAT;
      if (!pat) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Azure DevOps PAT not configured",
        });
      }

      // Build description with auto-captured context
      const contextLines = [
        input.description ?? "",
        "",
        "---",
        `**Submitted by:** ${ctx.session.email}`,
        `**App version:** ${input.appVersion ?? "unknown"}`,
        input.pageUrl ? `**Page:** ${input.pageUrl}` : "",
        `**Timestamp:** ${new Date().toISOString()}`,
      ].filter(Boolean);

      const body = contextLines.join("\n");

      // Azure DevOps Work Items API uses JSON Patch format
      const patchDoc = [
        { op: "add", path: "/fields/System.Title", value: input.title },
        { op: "add", path: "/fields/System.Description", value: body },
        { op: "add", path: "/fields/System.Tags", value: "user-feedback" },
      ];

      // Add repro steps for bugs
      if (input.type === "Bug") {
        patchDoc.push({
          op: "add",
          path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
          value: body,
        });
      }

      const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/$${input.type}?api-version=${API_VERSION}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json-patch+json",
          Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
        },
        body: JSON.stringify(patchDoc),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Azure DevOps API error (${response.status}): ${err.substring(0, 200)}`,
        });
      }

      const result = await response.json();
      return {
        id: result.id as number,
        url: result._links?.html?.href as string | undefined,
      };
    }),
});
