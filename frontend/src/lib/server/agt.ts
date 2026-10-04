import crypto from "node:crypto";

export type AgtDocumentStatus = "NOT_SUBMITTED" | "PENDING" | "VALID" | "INVALID";

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

export function signAgtJws(payload: Record<string, unknown>) {
  const privateKey = process.env.AGT_PRIVATE_KEY_PEM;
  if (!privateKey) {
    throw new Error("AGT_PRIVATE_KEY_PEM is not configured");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign({
    key: privateKey.replace(/\\n/g, "\n"),
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  return `${signingInput}.${base64Url(signature)}`;
}

export function buildAgtQrUrl(documentNo: string, taxRegistrationNumber?: string) {
  if (!taxRegistrationNumber || !documentNo) return null;

  const base =
    process.env.AGT_QR_BASE_URL ||
    "https://quiosqueagt.minfin.gov.ao/eletronica/consultar-qrcode";

  const url = new URL(base);
  url.searchParams.set("emissor", taxRegistrationNumber);
  url.searchParams.set("document", documentNo);
  return url.toString();
}

export function getAgtConfiguration() {
  return {
    enabled: process.env.AGT_ENABLED === "true",
    environment: process.env.AGT_ENVIRONMENT || "hml",
    taxRegistrationNumber: process.env.AGT_TAX_REGISTRATION_NUMBER || "",
    softwareValidationNumber: process.env.AGT_SOFTWARE_VALIDATION_NUMBER || "",
    softwareName: process.env.AGT_SOFTWARE_NAME || "e-Commerce",
    softwareVersion: process.env.AGT_SOFTWARE_VERSION || "1.0.0",
  };
}
