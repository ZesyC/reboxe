import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { DomainError, type EvidenceModule } from "@reboxe/backend";
import { evidenceUploadSchema } from "@reboxe/shared";
import { EVIDENCE } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import type { Actor } from "../types/authenticated-request";

@Controller("v1/disputes/:caseId/evidence-uploads")
export class EvidenceController {
  constructor(@Inject(EVIDENCE) private readonly evidence: EvidenceModule) {}
  @Post()
  prepare(@CurrentActor() actor: Actor, @Param("caseId") caseId: string, @Body() body: unknown) {
    const input = evidenceUploadSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid evidence upload");
    return this.evidence.prepare(actor.id, caseId, input.data);
  }
  @Post(":uploadId/complete")
  complete(@CurrentActor() actor: Actor, @Param("caseId") caseId: string, @Param("uploadId") uploadId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(uploadId)) throw new DomainError("VALIDATION_FAILED", 422, "Invalid upload ID");
    return this.evidence.complete(actor.id, caseId, uploadId);
  }
}
