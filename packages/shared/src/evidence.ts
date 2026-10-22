import { z } from "zod";
export const evidenceUploadSchema = z.object({
  processingRecordId: z.string().min(1), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024), checksum: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export type EvidenceUploadInput = z.infer<typeof evidenceUploadSchema>;
export type EvidenceUploadIntent = { id: string; uploadUrl: string; headers: Record<string, string>; expiresAt: string };
