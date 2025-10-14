import { getUncachableGmailClient } from "../googleMailClient";
import { gmailOAuthService } from "./gmailOAuthService";
import { storage } from "../storage";
import { mistralOcrService as ocrService } from "./mistralOcrService";
import { comparisonService } from "./comparisonService";
import { aiResponseService } from "./aiResponseService";
import { getUncachableResendClient } from "../resendClient";
import { generateRequestToken, formatReplyToEmail, extractTokenFromEmail } from "../utils/tokenGenerator";
import type { Email } from "@shared/schema";
import fs from "fs";
import path from "path";

export class EmailService {
  private async getGmailClient() {
    // Try custom OAuth first, fallback to Replit connector
    try {
      if (gmailOAuthService.isConfigured()) {
        return await gmailOAuthService.getGmailClient();
      }
    } catch (error) {
      console.log('Custom OAuth not available, trying Replit connector...');
    }
    
    // Fallback to Replit connector
    return await getUncachableGmailClient();
  }

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

      const gmail = await this.getGmailClient();
      
      // Generate unique request token
      const requestToken = generateRequestToken();
      const replyToEmail = formatReplyToEmail(requestToken);
      
      // Create email with attachments
      const subject = `Forespørgsel om forsikringstilbud - ${user.name || user.email}`;
      
      let emailContent = [
        `To: ${company.email}`,
        `From: hej@bedretilbud.com`,
        `Reply-To: ${replyToEmail}`,
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
        requestToken,
        replyToEmail,
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

  async sendFollowUpEmail(threadId: string, emailBody: string, questionIds?: string[]): Promise<Email> {
    try {
      const thread = await storage.getEmailThread(threadId);
      
      if (!thread) {
        throw new Error("Email thread not found");
      }

      const company = await storage.getCompany(thread.companyId ?? '');
      
      if (!company) {
        throw new Error("Company not found");
      }

      const { client: resend, fromEmail } = await getUncachableResendClient();
      
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: company.email,
        subject: thread.subject ? `Re: ${thread.subject}` : 'Follow-up',
        text: emailBody,
        replyTo: thread.replyToEmail || undefined
      });

      const email = await storage.createEmail({
        threadId: thread.id,
        messageId: emailResult.data?.id || '',
        direction: 'outbound',
        subject: thread.subject ? `Re: ${thread.subject}` : 'Follow-up',
        body: emailBody,
        metadata: questionIds ? { questionIds } : null,
        sentAt: new Date()
      });

      await storage.updateEmailThread(thread.id, { status: 'sent' });

      return email;
    } catch (error) {
      console.error("Failed to send follow-up email:", error);
      throw new Error(`Failed to send follow-up email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkInbox(): Promise<{ messagesFound: number; messagesProcessed: number; newDocuments: number }> {
    try {
      const gmail = await this.getGmailClient();
      
      // Get recent messages (only from last 24 hours for faster performance)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const dateQuery = `after:${Math.floor(oneDayAgo.getTime() / 1000)}`;
      
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: dateQuery,
        maxResults: 20  // Reduced from 100 for faster processing
      });

      const messagesFound = messages.data.messages?.length || 0;
      console.log(`📨 Checking inbox: Found ${messagesFound} messages in last 24 hours`);

      let messagesProcessed = 0;
      let newDocuments = 0;

      if (!messages.data.messages) {
        return { messagesFound: 0, messagesProcessed: 0, newDocuments: 0 };
      }

      for (const message of messages.data.messages) {
        const result = await this.processIncomingMessage(message.id!);
        if (result.processed) {
          messagesProcessed++;
          newDocuments += result.documentsCreated;
        }
      }

      console.log(`✅ Inbox check complete: ${messagesProcessed} processed, ${newDocuments} new documents`);
      return { messagesFound, messagesProcessed, newDocuments };
    } catch (error) {
      console.error("Failed to check inbox:", error);
      throw error;
    }
  }

  private async processIncomingMessage(messageId: string): Promise<{ processed: boolean; documentsCreated: number }> {
    try {
      const gmail = await this.getGmailClient();
      
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const headers = message.data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const deliveredTo = headers.find((h: any) => h.name === 'Delivered-To')?.value || '';
      const xForwardedTo = headers.find((h: any) => h.name === 'X-Forwarded-To')?.value || '';
      const xOriginalTo = headers.find((h: any) => h.name === 'X-Original-To')?.value || '';
      const threadId = message.data.threadId || '';

      console.log(`📧 Processing message ${messageId}`);
      console.log(`   To: ${to}`);
      console.log(`   Delivered-To: ${deliveredTo}`);
      console.log(`   X-Forwarded-To: ${xForwardedTo}`);
      console.log(`   X-Original-To: ${xOriginalTo}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   ThreadId: ${threadId}`);

      // Multi-level thread matching strategy
      let existingThread;
      let matchedToken: string | null = null;
      
      // Level 1: Try token-based matching (check all forwarding headers)
      const emailsToCheck = [to, deliveredTo, xForwardedTo, xOriginalTo].filter(Boolean);
      
      for (const email of emailsToCheck) {
        const token = extractTokenFromEmail(email);
        if (token) {
          existingThread = await storage.getEmailThreadByToken(token);
          if (existingThread) {
            matchedToken = token;
            console.log(`✅ Thread matched by token: ${token} (from header: ${email})`);
            break;
          }
        }
      }
      
      // Level 2: Fallback to Gmail threadId matching
      if (!existingThread && threadId) {
        existingThread = await storage.getEmailThreadByGmailId(threadId);
        if (existingThread) {
          console.log(`⚠️ Thread matched by Gmail threadId (fallback): ${threadId}`);
        }
      }
      
      if (!existingThread) {
        console.log(`❌ No thread found for message.`);
        console.log(`   Checked emails: ${emailsToCheck.join(', ')}`);
        console.log(`   Gmail ThreadId: ${threadId}`);
        return { processed: false, documentsCreated: 0 };
      }

      // Check if we already processed this message
      const existingEmails = await storage.getThreadEmails(existingThread.id);
      const alreadyProcessed = existingEmails.some(e => e.messageId === messageId);
      
      if (alreadyProcessed) {
        console.log(`⏭️ Message ${messageId} already processed, skipping`);
        return { processed: false, documentsCreated: 0 };
      }

      // Extract email body (support both simple and multipart messages)
      let body = '';
      
      const extractBody = (payload: any): string => {
        // Direct body data (simple messages)
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString();
        }
        
        // Multipart message - look for text/plain or text/html
        if (payload.parts) {
          for (const part of payload.parts) {
            const mimeType = part.mimeType || '';
            
            // Prefer text/plain
            if (mimeType === 'text/plain' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString();
            }
            
            // Fallback to text/html
            if (mimeType === 'text/html' && part.body?.data) {
              const htmlBody = Buffer.from(part.body.data, 'base64').toString();
              // Strip HTML tags for plain text
              return htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            
            // Recursive check for nested multipart
            if (mimeType.includes('multipart') && part.parts) {
              const nestedBody = extractBody(part);
              if (nestedBody) return nestedBody;
            }
          }
        }
        
        return '';
      };
      
      body = extractBody(message.data.payload);

      // Process attachments
      const attachments: any[] = [];
      let documentsCreated = 0;
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
              documentsCreated++;

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
                    savings: Math.round(comparison.savings || 0)
                  });
                }
              }
              
              attachments.push({ fileName, filePath });
            }
          }
        }
      }

      // Check if this is a reply to missing info questions
      const previousEmails = await storage.getThreadEmails(existingThread.id, 'outbound');
      const lastOutboundEmail = previousEmails.length > 0 ? previousEmails[previousEmails.length - 1] : null;
      
      if (lastOutboundEmail && lastOutboundEmail.metadata && (lastOutboundEmail.metadata as any).questionIds) {
        const questionIds = (lastOutboundEmail.metadata as any).questionIds as string[];
        
        // Get the comparison for this thread
        const comparisons = await storage.getUserComparisons(existingThread.userId ?? '');
        const comparison = comparisons.find(c => c.companyId === existingThread.companyId);
        
        if (comparison && comparison.comparisonData) {
          const comparisonData = comparison.comparisonData as any;
          
          // Extract all questions from comparison
          const allQuestions: any[] = [];
          if (comparisonData.missingInfo?.categories) {
            comparisonData.missingInfo.categories.forEach((cat: any) => {
              cat.questions.forEach((q: any) => {
                if (questionIds.includes(q.id)) {
                  allQuestions.push(q);
                }
              });
            });
          }
          
          if (allQuestions.length > 0) {
            console.log(`[Missing Info] Extracting answers for ${allQuestions.length} questions from company reply`);
            
            // Extract answers using AI
            const extractedAnswers = await comparisonService.extractAnswersFromReply(body, allQuestions);
            
            // Update questions with answers in comparison data
            if (extractedAnswers.length > 0) {
              comparisonData.missingInfo.categories.forEach((cat: any) => {
                cat.questions.forEach((q: any) => {
                  const answer = extractedAnswers.find(a => a.questionId === q.id);
                  if (answer) {
                    q.answer = answer.answer;
                    console.log(`[Missing Info] Matched answer for question ${q.id}`);
                  }
                });
              });
              
              // Update comparison in database
              const { db } = await import("../db");
              const { comparisons: comparisonsTable } = await import("@shared/schema");
              const { eq } = await import("drizzle-orm");
              
              await db
                .update(comparisonsTable)
                .set({ comparisonData })
                .where(eq(comparisonsTable.id, comparison.id));
              
              console.log(`[Missing Info] Updated comparison ${comparison.id} with ${extractedAnswers.length} answers`);
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

      // Generate and send AI auto-response (for text-only replies)
      if (body && existingThread.companyId) {
        const hasAttachments = attachments.length > 0;
        
        // Check user's AI auto-response preference
        const user = await storage.getUser(existingThread.userId ?? '');
        const aiEnabled = user?.aiAutoResponseEnabled !== false; // Default to true if not set
        
        // Check if we should auto-respond
        if (aiEnabled && aiResponseService.shouldAutoRespond(body, hasAttachments)) {
          try {
            const company = await storage.getCompany(existingThread.companyId);
            const conversationHistory = await storage.getThreadEmails(existingThread.id);
            
            if (company) {
              console.log(`[AI Auto-Response] Generating response for thread ${existingThread.id}`);
              
              // Generate AI response
              const aiResponse = await aiResponseService.generateResponse({
                userId: existingThread.userId ?? '',
                companyName: company.name,
                threadId: existingThread.id,
                incomingMessage: body,
                conversationHistory: conversationHistory.map(e => ({
                  direction: e.direction || '',
                  body: e.body || '',
                  sentAt: e.sentAt || new Date()
                }))
              });

              // Check if AI flagged for human review
              if (aiResponse.includes('DO NOT RESPOND - FLAG FOR HUMAN REVIEW')) {
                console.log(`[AI Auto-Response] Flagged for human review, not sending`);
                
                // Store as draft for human review
                await storage.createEmail({
                  threadId: existingThread.id,
                  messageId: '',
                  direction: 'auto',
                  subject: `[NEEDS REVIEW] Re: ${subject}`,
                  body: aiResponse,
                  attachments: [],
                  sentAt: new Date()
                });
              } else {
                // Send via Resend
                const { client: resend, fromEmail } = await getUncachableResendClient();
                
                const emailResult = await resend.emails.send({
                  from: fromEmail,
                  to: company.email,
                  subject: `Re: ${subject}`,
                  text: aiResponse,
                  replyTo: formatReplyToEmail(existingThread.requestToken || '')
                });

                console.log(`[AI Auto-Response] Email sent via Resend: ${emailResult.data?.id}`);

                // Store sent auto-response
                await storage.createEmail({
                  threadId: existingThread.id,
                  messageId: emailResult.data?.id || '',
                  direction: 'auto',
                  subject: `Re: ${subject}`,
                  body: aiResponse,
                  attachments: [],
                  sentAt: new Date()
                });

                console.log(`[AI Auto-Response] Successfully responded to ${company.name}`);
              }
            }
          } catch (error) {
            console.error('[AI Auto-Response] Failed to generate/send response:', error);
            // Continue processing - don't fail the whole inbox check
          }
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

      return { processed: true, documentsCreated };

    } catch (error) {
      console.error("Failed to process incoming message:", error);
      return { processed: false, documentsCreated: 0 };
    }
  }
}

export const emailService = new EmailService();
