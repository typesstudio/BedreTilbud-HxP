import { randomBytes } from "crypto";
import { storage } from "../storage";
import type { MagicLink } from "@shared/schema";

const TOKEN_LENGTH = 64;
const EXPIRES_IN_DAYS = 14;

export class MagicLinkService {
  async create(userId: string, comparisonId: string, redirectPath: string): Promise<MagicLink> {
    const token = randomBytes(TOKEN_LENGTH / 2).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPIRES_IN_DAYS);

    const magicLink = await storage.createMagicLink({
      userId,
      comparisonId,
      token,
      redirectPath,
      expiresAt,
    });

    return magicLink;
  }

  async consume(token: string): Promise<{ valid: boolean; magicLink?: MagicLink; error?: string }> {
    const magicLink = await storage.getMagicLinkByToken(token);

    if (!magicLink) {
      return { valid: false, error: "Token ikke fundet" };
    }

    const now = new Date();
    if (now > magicLink.expiresAt) {
      return { valid: false, error: "Linket er udløbet" };
    }

    return { valid: true, magicLink };
  }

  buildMagicLinkUrl(token: string, baseUrl: string): string {
    return `${baseUrl}/magic/${token}`;
  }
}

export const magicLinkService = new MagicLinkService();
