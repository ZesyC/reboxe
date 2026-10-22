import { z } from "zod";

export const aiReportSchema = z.object({
  schemaVersion: z.literal("triage-v1"), modelId: z.string().min(1).max(200),
  modelRevision: z.string().regex(/^[a-f0-9]{40}$/), promptVersion: z.literal("unboxing-v1"),
  evidenceChecksum: z.string().regex(/^[a-f0-9]{64}$/), durationSeconds: z.number().min(0).max(90),
  sampledTimestamps: z.array(z.number().min(0).max(90)).min(1).max(16),
  visualAssessment: z.object({
    assessment: z.enum(["VISIBLE_DAMAGE", "NO_CLEAR_DAMAGE", "INSUFFICIENT_EVIDENCE"]),
    observations: z.array(z.object({ timestamp_seconds: z.number().min(0).max(90), description: z.string().min(1).max(500) }).strict()).max(16),
    limitations: z.array(z.string().max(500)).max(10)
  }).strict(),
  recommendation: z.literal("ADMIN_REVIEW"), financialAction: z.literal("NONE"), calibrated: z.literal(false)
}).strict().superRefine((report, context) => {
  for (const item of report.visualAssessment.observations) {
    if (item.timestamp_seconds > report.durationSeconds || !report.sampledTimestamps.some((time) => Math.abs(time - item.timestamp_seconds) < 0.05)) {
      context.addIssue({ code: "custom", message: "Observation timestamp must cite a sampled frame within the media" });
    }
  }
});
export type AiReport = z.infer<typeof aiReportSchema>;
