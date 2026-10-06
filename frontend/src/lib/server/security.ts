import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return createHash("sha256").update(secret).digest();
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function totp(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1000000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  return [-1, 0, 1].some((step) => totp(secret, now + step * 30000) === normalized);
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => `${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`);
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function userAgent(request: Request) {
  return request.headers.get("user-agent") || "unknown";
}

export function deviceName(agent: string) {
  if (/android/i.test(agent)) return "Android";
  if (/iphone|ipad|ios/i.test(agent)) return "iPhone/iPad";
  if (/windows/i.test(agent)) return "Windows";
  if (/mac os|macintosh/i.test(agent)) return "macOS";
  if (/linux/i.test(agent)) return "Linux";
  return "Dispositivo";
}

export async function securityEvent(userId: number, type: string, request: Request, metadata: Prisma.InputJsonValue = {}) {
  return prisma.securityEvent.create({
    data: {
      userId,
      type,
      status: "SUCCESS",
      ipAddress: requestIp(request),
      userAgent: userAgent(request),
      metadata,
    },
  });
}

export async function createSecuritySession(userId: number, token: string, request: Request, expiresAt: Date) {
  const decoded = jwt.decode(token) as { jti?: string } | null;
  if (!decoded?.jti) return null;
  const agent = userAgent(request);
  return prisma.securitySession.create({
    data: {
      userId,
      tokenHash: hashToken(decoded.jti),
      deviceName: deviceName(agent),
      browser: /edg/i.test(agent) ? "Edge" : /firefox/i.test(agent) ? "Firefox" : /chrome/i.test(agent) ? "Chrome" : /safari/i.test(agent) ? "Safari" : "Browser",
      operatingSystem: deviceName(agent),
      ipAddress: requestIp(request),
      userAgent: agent,
      expiresAt,
    },
  });
}
