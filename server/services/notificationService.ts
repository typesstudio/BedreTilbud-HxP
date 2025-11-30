import { storage } from "../storage";
import { magicLinkService } from "./magicLinkService";
import { getUncachableResendClient } from "../resendClient";
import type { CompanyComparison } from "@shared/schema";

const APP_BASE_URL = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
  : process.env.APP_BASE_URL || 'http://localhost:5000';

export class NotificationService {
  async sendComparisonReady(comparisonId: string): Promise<{ sent: boolean; reason?: string }> {
    const comparison = await storage.getCompanyComparison(comparisonId);
    
    if (!comparison) {
      console.error(`[NotificationService] Comparison not found: ${comparisonId}`);
      return { sent: false, reason: "Sammenligning ikke fundet" };
    }

    if (comparison.notifiedAt) {
      console.log(`[NotificationService] Already notified for comparison ${comparisonId}, skipping`);
      return { sent: false, reason: "Allerede notificeret" };
    }

    const user = await storage.getUser(comparison.userId);
    if (!user) {
      console.error(`[NotificationService] User not found for comparison: ${comparisonId}`);
      return { sent: false, reason: "Bruger ikke fundet" };
    }

    const notification = await storage.createNotification({
      userId: comparison.userId,
      comparisonId: comparisonId,
      type: "comparison_ready",
      status: "pending",
    });

    try {
      const redirectPath = `/sammenligning/${comparisonId}`;
      const magicLink = await magicLinkService.create(
        comparison.userId,
        comparisonId,
        redirectPath
      );

      const magicLinkUrl = magicLinkService.buildMagicLinkUrl(magicLink.token, APP_BASE_URL);

      const offerCompanyName = await this.getCompanyName(comparison.offerCompany);

      await this.sendEmail(user.email, user.name || "Kunde", offerCompanyName, magicLinkUrl);

      await storage.updateNotificationStatus(notification.id, "sent");
      await storage.updateCompanyComparisonNotifiedAt(comparisonId);

      console.log(`[NotificationService] Successfully sent comparison notification for ${comparisonId} to ${user.email}`);
      return { sent: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[NotificationService] Failed to send notification for ${comparisonId}:`, errorMessage);
      
      await storage.updateNotificationStatus(notification.id, "failed", errorMessage);
      return { sent: false, reason: errorMessage };
    }
  }

  private async getCompanyName(companyId: string): Promise<string> {
    const company = await storage.getCompany(companyId);
    return company?.name || "nyt tilbud";
  }

  private async sendEmail(
    toEmail: string,
    userName: string,
    offerCompanyName: string,
    magicLinkUrl: string
  ): Promise<void> {
    const { client, fromEmail } = await getUncachableResendClient();

    const firstName = userName.split(" ")[0] || "Kunde";

    const subject = `Din forsikringssammenligning fra ${offerCompanyName} er klar`;

    const html = `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Din sammenligning er klar</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                BedreTilbud
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a;">
                Hej ${firstName},
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                God nyt! Vi har modtaget et tilbud fra <strong>${offerCompanyName}</strong> og har lavet en detaljeret sammenligning med dine nuværende forsikringer.
              </p>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Klik på knappen nedenfor for at se din personlige sammenligning og finde ud af, om du kan spare penge.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; padding: 16px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                      Se min sammenligning
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px 40px; border-top: 1px solid #e5e5e5; margin-top: 32px;">
              <p style="margin: 0 0 12px; font-size: 14px; color: #6b6b6b; text-align: center;">
                Linket er gyldigt i 14 dage.
              </p>
              <p style="margin: 0; font-size: 14px; color: #6b6b6b; text-align: center;">
                Hvis du har spørgsmål, er du velkommen til at svare på denne email.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Unsubscribe Footer -->
        <table role="presentation" style="max-width: 600px; width: 100%; margin-top: 24px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9a9a9a;">
                BedreTilbud | Danmark
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
Hej ${firstName},

God nyt! Vi har modtaget et tilbud fra ${offerCompanyName} og har lavet en detaljeret sammenligning med dine nuværende forsikringer.

Se din sammenligning her: ${magicLinkUrl}

Linket er gyldigt i 14 dage.

Hvis du har spørgsmål, er du velkommen til at svare på denne email.

Med venlig hilsen,
BedreTilbud
    `.trim();

    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text,
    });
  }
}

export const notificationService = new NotificationService();
