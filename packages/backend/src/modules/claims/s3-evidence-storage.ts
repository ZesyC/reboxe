import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, PutObjectLegalHoldCommand, PutObjectRetentionCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3EvidenceStorage {
  constructor(private readonly client: S3Client, readonly bucket: string, readonly region: string) {}
  async uploadIntent(key: string, mimeType: string, checksum: string, retainUntil: Date) {
    const checksumBase64 = Buffer.from(checksum, "hex").toString("base64");
    const uploadUrl = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key,
      ContentType: mimeType, ChecksumSHA256: checksumBase64,
      ObjectLockMode: "COMPLIANCE", ObjectLockRetainUntilDate: retainUntil }),
    { expiresIn: 300, unhoistableHeaders: new Set(["x-amz-checksum-sha256", "x-amz-object-lock-mode", "x-amz-object-lock-retain-until-date"]) });
    return { uploadUrl, headers: { "content-type": mimeType, "x-amz-checksum-sha256": checksumBase64,
      "x-amz-object-lock-mode": "COMPLIANCE", "x-amz-object-lock-retain-until-date": retainUntil.toISOString() },
    expiresAt: new Date(Date.now() + 300_000).toISOString() };
  }
  async inspect(key: string) {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: "ENABLED" }));
    if (!result.VersionId || result.VersionId === "null" || result.ObjectLockMode !== "COMPLIANCE" || !result.ObjectLockRetainUntilDate || !result.ChecksumSHA256) {
      throw new Error("Evidence storage requires versioning, SHA-256 and compliance Object Lock");
    }
    return { version: result.VersionId, mimeType: result.ContentType, sizeBytes: result.ContentLength,
      checksum: Buffer.from(result.ChecksumSHA256, "base64").toString("hex"), retainUntil: result.ObjectLockRetainUntilDate };
  }
  async read(key: string, version: string, maxBytes = 20 * 1024 * 1024): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, VersionId: version, ChecksumMode: "ENABLED" }));
    if (!result.Body || !result.ContentLength || result.ContentLength > maxBytes) throw new Error("Invalid evidence object size");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of result.Body as AsyncIterable<Uint8Array>) {
      size += part.byteLength;
      if (size > maxBytes) throw new Error("Evidence exceeds size limit");
      chunks.push(Buffer.from(part));
    }
    return Buffer.concat(chunks);
  }
  async readUrl(key: string, version: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, VersionId: version }), { expiresIn: 60 });
  }
  async extendRetention(key: string, version: string, retainUntil: Date) {
    await this.client.send(new PutObjectRetentionCommand({ Bucket: this.bucket, Key: key, VersionId: version,
      Retention: { Mode: "COMPLIANCE", RetainUntilDate: retainUntil } }));
  }
  async legalHold(key: string, version: string, enabled: boolean) {
    await this.client.send(new PutObjectLegalHoldCommand({ Bucket: this.bucket, Key: key, VersionId: version, LegalHold: { Status: enabled ? "ON" : "OFF" } }));
  }
}
export function createS3EvidenceStorage(): S3EvidenceStorage | undefined {
  if (process.env.EVIDENCE_MODE !== "S3_WORM") return undefined;
  const bucket = process.env.EVIDENCE_S3_BUCKET;
  const region = process.env.EVIDENCE_S3_REGION;
  if (!bucket || !region) throw new Error("S3 evidence bucket and region are required");
  // Use AWS's credential provider chain; never put access keys in public configuration.
  return new S3EvidenceStorage(new S3Client({ region, maxAttempts: 2 }), bucket, region);
}
