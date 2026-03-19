import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const AZURE_ORG = "metstechnology";
const AZURE_PROJECT = "MIAS-IO";
const API_VERSION = "7.1";
const WORK_ITEM_TYPES = ["Bug", "User Story", "Task"] as const;

function authHeader(pat: string) {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

/** Upload a binary attachment to Azure DevOps, returns the attachment URL. */
async function uploadAttachment(
  pat: string,
  fileName: string,
  data: Buffer,
): Promise<string> {
  const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=${API_VERSION}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: authHeader(pat),
    },
    body: new Uint8Array(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Attachment upload failed (${res.status}): ${err.substring(0, 200)}`,
    });
  }
  const result = await res.json();
  return result.url as string;
}

export const feedbackRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(
      z.object({
        type: z.enum(WORK_ITEM_TYPES),
        title: z.string().min(1).max(255),
        description: z.string().max(5000).optional(),
        pageUrl: z.string().optional(),
        appVersion: z.string().optional(),
        // Attachments: base64-encoded files
        attachments: z.array(z.object({
          fileName: z.string(),
          base64: z.string(),
        })).optional(),
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

      // Upload attachments first
      const attachmentUrls: { url: string; fileName: string }[] = [];
      if (input.attachments?.length) {
        for (const att of input.attachments) {
          const buf = Buffer.from(att.base64, "base64");
          const url = await uploadAttachment(pat, att.fileName, buf);
          attachmentUrls.push({ url, fileName: att.fileName });
        }
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

      // Build JSON Patch document
      const patchDoc: { op: string; path: string; value: unknown }[] = [
        { op: "add", path: "/fields/System.Title", value: input.title },
        { op: "add", path: "/fields/System.Description", value: body },
        { op: "add", path: "/fields/System.Tags", value: "user-feedback" },
      ];

      if (input.type === "Bug") {
        patchDoc.push({
          op: "add",
          path: "/fields/Microsoft.VSTS.TCM.ReproSteps",
          value: body,
        });
      }

      // Add attachment relations
      for (const att of attachmentUrls) {
        patchDoc.push({
          op: "add",
          path: "/relations/-",
          value: {
            rel: "AttachedFile",
            url: att.url,
            attributes: { comment: att.fileName },
          },
        });
      }

      const url = `https://dev.azure.com/${AZURE_ORG}/${AZURE_PROJECT}/_apis/wit/workitems/$${input.type}?api-version=${API_VERSION}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json-patch+json",
          Authorization: authHeader(pat),
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
