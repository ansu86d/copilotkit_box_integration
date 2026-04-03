import { z } from "zod";

export const vendorIdSchema = z.string().min(2);
export const vendorNameSchema = z.string().min(2);
export const vendorEmailSchema = z.string().email();
export const reviewerRoleSchema = z.enum(["editor", "viewer", "previewer", "uploader"]);

export const createWorkspaceSchema = z.object({
  vendorName: vendorNameSchema.describe("Vendor display name, such as Acme Logistics"),
  region: z.string().default("US").describe("Vendor operating region"),
  riskTier: z.enum(["low", "medium", "high"]).default("medium"),
});

export const documentRequestSchema = z.object({
  vendorId: vendorIdSchema,
  title: z.string().optional(),
  description: z.string().optional(),
});

export const vendorLookupSchema = z.object({
  vendorId: vendorIdSchema,
});

export const vendorFolderLookupSchema = z.object({
  vendorId: vendorIdSchema,
  folder: z.enum(["intake", "review", "signed"]).default("review"),
});

export const reviewerSchema = z.object({
  vendorId: vendorIdSchema,
  reviewerEmail: vendorEmailSchema,
  role: reviewerRoleSchema.default("editor"),
});

export const reviewTaskSchema = z.object({
  fileId: z
    .string()
    .regex(/^\d+$/, "Use a verified numeric Box file id, not a filename."),
  message: z.string().min(3),
  dueAt: z.string().optional(),
});

export const signatureRequestSchema = z.object({
  vendorId: vendorIdSchema,
  signerEmail: vendorEmailSchema,
  documentLabel: z.string().default("NDA"),
  fileId: z.string().regex(/^\d+$/).optional().describe("Verified numeric Box file id from a prior folder listing"),
  signedFolderId: z.string().optional().describe("Box folder id where the signed copy will be saved"),
});

export const fillIntakePdfSchema = z.object({
  vendorId: vendorIdSchema,
  content: z.string().min(5).describe("Free-form vendor information to fill into the intake PDF"),
});
