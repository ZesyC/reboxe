import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { S3EvidenceStorage } from "../src/modules/claims/s3-evidence-storage";

describe("immutable evidence storage", () => {
  it("binds upload checksum and compliance retention into the signed request", async () => {
    const client = new S3Client({ region: "ap-southeast-1", credentials: { accessKeyId: "synthetic", secretAccessKey: "synthetic" } });
    const storage = new S3EvidenceStorage(client, "synthetic-private-evidence", "ap-southeast-1");
    const until = new Date(Date.now() + 90 * 86400_000);
    const intent = await storage.uploadIntent("original/case/id", "video/mp4", "a".repeat(64), until);
    expect(intent.headers["x-amz-object-lock-mode"]).toBe("COMPLIANCE");
    expect(intent.headers["x-amz-checksum-sha256"]).toBe(Buffer.from("a".repeat(64), "hex").toString("base64"));
    expect(new URL(intent.uploadUrl).searchParams.get("X-Amz-SignedHeaders")).toContain("x-amz-object-lock-mode");
    client.destroy();
  });
  it("rejects an object without immutable version, checksum or compliance lock", async () => {
    const client = { send: vi.fn(async () => ({ VersionId: "null", ContentLength: 10 })) } as unknown as S3Client;
    await expect(new S3EvidenceStorage(client, "bucket", "region").inspect("key")).rejects.toThrow(/requires versioning/);
  });
  it("reads exactly the requested object version and enforces the size limit", async () => {
    const send = vi.fn(async () => ({ ContentLength: 3, Body: [Buffer.from("abc")] }));
    const storage = new S3EvidenceStorage({ send } as unknown as S3Client, "bucket", "region");
    expect(await storage.read("key", "version-2")).toEqual(Buffer.from("abc"));
    expect(send.mock.calls[0]?.[0]).toMatchObject({ input: { VersionId: "version-2", Bucket: "bucket", Key: "key" } });
    await expect(storage.read("key", "version-2", 2)).rejects.toThrow(/size/);
  });
});
