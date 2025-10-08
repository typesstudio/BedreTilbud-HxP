import { getUncachableGmailClient } from "../googleMailClient";
import { storage } from "../storage";
import { ocrService } from "./ocrService";
import { comparisonService } from "./comparisonService";
import fs from "fs";
import path from "path";

export class EmailService {
  async sendInsuranceInquiry(
    userId: string,
    companyId: string,
    emailBody: string,
    attachmentPaths: string[]
  ): Promise<string> {
    try {
      const user = await storage.getUser(userId);
      const company = await storage.getCompany(companyId);
      
      if (!user || !company) {
        throw new Error("User or company not found");
      }

      const gmail = await getUncachableGmailClient();
      
      // Create email with attachments
      const subject = `Forespørgsel om forsikringstilbud - ${user.name || user.email}`;
      
      let emailContent = [
        `To: ${company.email}`,
        `From: ${user.email}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="boundary123"',
        '',
        '--boundary123',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        emailBody,
        '',
      ];

      // Add attachments
      for (const filePath of attachmentPaths) {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath).toString('base64');
          const fileName = path.basename(filePath);
          
          emailContent.push(
            '--boundary123',
            `Content-Type: application/pdf; name="${fileName}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${fileName}"`,
            '',
            fileContent,
            ''
          );
        }
      }
      
      emailContent.push('--boundary123--');
      
      const raw = Buffer.from(emailContent.join('\n')).toString('base64');
      
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw
        }
      });

      // Create email thread record
      const threadId = await storage.createEmailThread({
        userId,
        companyId,
        subject,
        threadId: result.data.threadId || '',
        status: 'sent'
      });

      // Record the sent email
      await storage.createEmail({
        threadId: threadId.id,
        messageId: result.data.id || '',
        direction: 'outbound',
        subject,
        body: emailBody,
        attachments: attachmentPaths.map(p => ({ fileName: path.basename(p), filePath: p })),
        sentAt: new Date()
      });

      return threadId.id;
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Failed to send insurance inquiry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkInbox(): Promise<void> {
    try {
      const gmail = await getUncachableGmailClient();
      
      // Get recent messages
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 50
      });

      if (!messages.data.messages) return;

      for (const message of messages.data.messages) {
        await this.processIncomingMessage(message.id!);
      }
    } catch (error) {
      console.error("Failed to check inbox:", error);
    }
  }

  private async processIncomingMessage(messageId: string): Promise<void> {
    try {
      const gmail = await getUncachableGmailClient();
      
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const headers = message.data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const threadId = message.data.threadId || '';

      // Find existing thread
      const existingThread = await storage.getEmailThreadByGmailId(threadId);
      if (!existingThread) return;

      // Extract email body
      let body = '';
      if (message.data.payload?.body?.data) {
        body = Buffer.from(message.data.payload.body.data, 'base64').toString();
      }

      // Process attachments
      const attachments: any[] = [];
      if (message.data.payload?.parts) {
        for (const part of message.data.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: part.body.attachmentId
            });
            
            if (attachment.data.data && part.filename.toLowerCase().endsWith('.pdf')) {
              // Save PDF and process with OCR
              const fileName = `attachment_${Date.now()}_${part.filename}`;
              const filePath = path.join('uploads', fileName);
              
              fs.writeFileSync(filePath, Buffer.from(attachment.data.data, 'base64'));
              
              // Extract insurance data
              const insuranceData = await ocrService.extractInsuranceDataFromPDF(filePath);
              
              // Create document record
              const document = await storage.createDocument({
                userId: existingThread.userId,
                fileName,
                filePath,
                fileSize: Buffer.from(attachment.data.data, 'base64').length,
                ocrData: insuranceData,
                documentType: 'offer',
                companyId: existingThread.companyId
              });

              // Create comparison if we have a current policy
              const currentDocuments = await storage.getUserDocuments(existingThread.userId ?? '', 'current');
              if (currentDocuments.length > 0) {
                const currentDoc = currentDocuments[0];
                if (currentDoc.ocrData) {
                  const comparison = await comparisonService.compareInsurancePolicies(
                    currentDoc.ocrData as any,
                    insuranceData
                  );
                  
                  await storage.createComparison({
                    userId: existingThread.userId,
                    currentDocumentId: currentDoc.id,
                    offerDocumentId: document.id,
                    companyId: existingThread.companyId,
                    comparisonData: comparison,
                    aiRecommendation: comparison.aiRecommendation,
                    savings: comparison.savings
                  });
                }
              }
              
              attachments.push({ fileName, filePath });
            }
          }
        }
      }

      // Record incoming email
      await storage.createEmail({
        threadId: existingThread.id,
        messageId: messageId,
        direction: 'inbound',
        subject,
        body,
        attachments,
        sentAt: new Date(parseInt(message.data.internalDate || '0'))
      });

      // Update thread status
      await storage.updateEmailThread(existingThread.id, { status: 'received' });

      // Generate auto-response
      if (body && existingThread.companyId) {
        const company = await storage.getCompany(existingThread.companyId);
        const user = await storage.getUser(existingThread.userId ?? '');
        const sentEmails = await storage.getThreadEmails(existingThread.id, 'outbound');
        
        if (company && user && sentEmails.length > 0) {
          const autoResponse = await comparisonService.generateAutoResponse(body, {
            companyName: company.name,
            userInfo: user,
            sentEmail: sentEmails[0].body || ''
          });
          
          // Store auto-response (but don't send automatically)
          await storage.createEmail({
            threadId: existingThread.id,
            messageId: '',
            direction: 'auto',
            subject: `Re: ${subject}`,
            body: autoResponse,
            attachments: [],
            sentAt: new Date()
          });
        }
      }

      // Mark as read
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

    } catch (error) {
      console.error("Failed to process incoming message:", error);
    }
  }
}

export const emailService = new EmailService();
