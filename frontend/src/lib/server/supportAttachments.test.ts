import assert from "node:assert/strict";
import test from "node:test";
import { readSupportChatRequest, SUPPORT_ATTACHMENT_MAX_BYTES } from "./supportAttachments";

const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);

function requestWithAttachment(name: string, type: string, data: Uint8Array) {
  const form = new FormData();
  form.append("content", "");
  form.append("conversationId", "42");
  const blobData = new Uint8Array(data.length);
  blobData.set(data);
  form.append("attachment", new Blob([blobData.buffer], { type }), name);
  return new Request("http://localhost/api/support/chat", { method: "POST", body: form });
}

test("parses a valid attachment and normalizes numeric form fields", async () => {
  const result = await readSupportChatRequest(requestWithAttachment("evidence.png", "image/png", pngSignature));

  assert.equal(result.error, null);
  assert.deepEqual(result.fields, { content: "", conversationId: "42" });
  assert.equal(result.attachment?.name, "evidence.png");
  assert.equal(result.attachment?.type, "image/png");
  assert.equal(result.attachment?.size, pngSignature.length);
  assert.deepEqual(result.attachment?.data, pngSignature);
});

test("rejects an attachment whose bytes do not match its declared type", async () => {
  const result = await readSupportChatRequest(requestWithAttachment("evidence.png", "image/png", new Uint8Array([1, 2, 3])));

  assert.match(result.error || "", /não corresponde ao formato/);
});

test("rejects unsupported attachment types", async () => {
  const result = await readSupportChatRequest(requestWithAttachment("notes.txt", "text/plain", new Uint8Array([1])));

  assert.match(result.error || "", /Formato não permitido/);
});

test("rejects attachments larger than the configured limit", async () => {
  const data = new Uint8Array(SUPPORT_ATTACHMENT_MAX_BYTES + 1);
  data.set(pngSignature);
  const result = await readSupportChatRequest(requestWithAttachment("large.png", "image/png", data));

  assert.match(result.error || "", /não pode exceder 3 MB/);
});

test("accepts a browser-recorded WebM voice message", async () => {
  const webmSignature = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93]);
  const result = await readSupportChatRequest(requestWithAttachment("voice.webm", "audio/webm;codecs=opus", webmSignature));

  assert.equal(result.error, null);
  assert.equal(result.attachment?.type, "audio/webm");
});
