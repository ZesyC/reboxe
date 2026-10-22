import { Controller, Get, Inject, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DomainError, type ClaimsAiModule } from "@reboxe/backend";
import { CLAIMS_AI } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import type { Actor } from "../types/authenticated-request";

@Controller("v1/admin/disputes/:caseId/ai-reports")
export class ClaimsAiController {
  constructor(@Inject(CLAIMS_AI) private readonly ai: ClaimsAiModule) {}
  @Get()
  list(@CurrentActor() actor: Actor, @Param("caseId") caseId: string) { return this.ai.list(actor, caseId); }
  @Get("evidences")
  evidences(@CurrentActor() actor: Actor, @Param("caseId") caseId: string) { return this.ai.evidences(actor, caseId); }
  @Post(":evidenceId/stored")
  analyzeStored(@CurrentActor() actor: Actor, @Param("caseId") caseId: string, @Param("evidenceId") evidenceId: string) {
    return this.ai.analyzeStored(actor, caseId, evidenceId);
  }
  @Post(":evidenceId")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  analyze(@CurrentActor() actor: Actor, @Param("caseId") caseId: string, @Param("evidenceId") evidenceId: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string }) {
    if (!file) throw new DomainError("VALIDATION_FAILED", 422, "Recorded evidence file is required");
    return this.ai.analyze(actor, caseId, evidenceId, file.buffer, file.mimetype);
  }
}
