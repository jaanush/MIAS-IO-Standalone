import type { PrismaClient } from "../generated/prisma/client/client";
import { hashPassword } from "../../src/lib/auth";

export async function seedProject(prisma: PrismaClient) {
  console.log("Seeding default project + admin user...");

  // Admin user
  const adminEmail = "admin@mias.io";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await hashPassword("admin123"),
    },
    update: {},
  });
  console.log(`  User: ${admin.email} (${admin.role})`);

  // Project 1
  const project = await prisma.project.upsert({
    where: { id: 1 },
    create: {
      name: "Demo Project",
      status: "ACTIVE",
      createdBy: admin.id,
    },
    update: {},
  });
  console.log(`  Project: #${project.id} "${project.name}"`);

  // Make admin a member
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    create: { projectId: project.id, userId: admin.id, role: "OWNER" },
    update: {},
  });
  console.log("  Admin added as project owner");
}
