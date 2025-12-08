import { getUncachableGmailClient } from "../googleMailClient";
import { gmailOAuthService } from "./gmailOAuthService";
import { storage } from "../storage";
import { mistralOcrService as ocrService } from "./mistralOcrService";
import { comparisonService } from "./comparisonService";
import { aiResponseService } from "./aiResponseService";
import { PolicyMatchingService } from "./policyMatchingService";
import { getUncachableResendClient } from "../resendClient";
import { generateRequestToken, formatReplyToEmail, extractTokenFromEmail } from "../utils/tokenGenerator";
import { parseEmailReply } from "../utils/emailReplyParser";
import { parsePolicyType } from "../utils/policyExtractionParser";
import type { Email } from "@shared/schema";
import fs from "fs";
import path from "path";

function generateRequestPdfAutoResponse(companyName?: string): string {
  const greeting = companyName ? `Hej ${companyName}` : 'Hej';
  
  return `${greeting}

Tak for jeres svar.

For at vi kan behandle tilbuddet i BedreTilbud, skal vi have selve forsikringstilbuddet som PDF vedhæftet denne mail.

Vil I sende policen/policerne som PDF i et svar på denne mail?

På forhånd tak.

Venlig hilsen
BedreTilbud`;
}

function generateRequestPdfHasFilesAutoResponse(companyName?: string): string {
  const greeting = companyName ? `Hej ${companyName}` : 'Hej';
  
  return `${greeting}

Tak for jeres svar og de vedhæftede filer.

For at vi kan behandle tilbuddet i BedreTilbud, skal vi have selve forsikringstilbuddet som PDF vedhæftet denne mail.

Vil I sende policen/policerne som PDF i et svar på denne mail?

På forhånd tak.

Venlig hilsen
BedreTilbud`;
}

/**
 * Encode a string for use in email headers (RFC 2047).
 * Handles Danish characters (ÆØÅ) and other non-ASCII characters.
 */
function encodeEmailHeader(text: string): string {
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  if (!hasNonAscii) {
    return text;
  }
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  return `=?UTF-8?B?${base64}?=`;
}

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
      
      // Format sender name with user's name for better identification
      const senderName = user.name ? `${user.name} via BedreTilbud` : 'BedreTilbud';
      const fromHeader = `${encodeEmailHeader(senderName)} <hej@bedretilbud.com>`;
      
      let emailContent = [
        `To: ${company.email}`,
        `From: ${fromHeader}`,
        `Reply-To: ${replyToEmail}`,
        `Subject: ${encodeEmailHeader(subject)}`,
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

  async sendFollowUpEmail(
    threadId: string, 
    emailBody: string, 
    options?: { questionIds?: string[]; existingDraftId?: string }
  ): Promise<Email> {
    try {
      const thread = await storage.getEmailThread(threadId);
      
      if (!thread) {
        throw new Error("Email thread not found");
      }

      const company = await storage.getCompany(thread.companyId ?? '');
      
      if (!company) {
        throw new Error("Company not found");
      }

      // Get user for personalized sender name
      const user = thread.userId ? await storage.getUser(thread.userId) : null;

      // Get all non-draft emails in the thread to build threading headers
      // Gmail requires proper In-Reply-To and References headers for thread grouping
      const threadEmails = await storage.getThreadEmails(thread.id);
      const sentEmails = threadEmails
        .filter(e => e.status !== 'draft')
        .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      
      // Collect all valid RFC Message-IDs from inbound emails (these have proper emailMessageId)
      // Outbound emails via Resend don't have RFC-compliant Message-IDs we can reference
      const messageIds = sentEmails
        .filter(e => e.emailMessageId && e.emailMessageId.length > 0)
        .map(e => e.emailMessageId as string);
      
      // Get the most recent Message-ID for In-Reply-To header
      const lastEmailMessageId = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null;
      
      // Build References header with all previous Message-IDs for proper threading
      const referencesHeader = messageIds.length > 0 ? messageIds.join(' ') : null;

      const { client: resend, fromEmail } = await getUncachableResendClient();
      
      // Format sender with user's name for personalized from address
      // Resend format: "Name <email@domain.com>"
      const senderName = user?.name ? `${user.name} via BedreTilbud` : 'BedreTilbud';
      const formattedFrom = `${senderName} <${fromEmail.includes('<') ? fromEmail.match(/<(.+)>/)?.[1] || fromEmail : fromEmail}>`;
      
      // Prepare email headers with threading support
      // Both In-Reply-To (last message) and References (full chain) are needed for Gmail threading
      const emailHeaders: Record<string, string> = {};
      if (lastEmailMessageId) {
        emailHeaders['In-Reply-To'] = lastEmailMessageId;
      }
      if (referencesHeader) {
        emailHeaders['References'] = referencesHeader;
      }
      
      console.log(`[Email Threading] Sending reply with headers:`, {
        inReplyTo: lastEmailMessageId || 'none',
        references: referencesHeader ? `${messageIds.length} message(s)` : 'none'
      });
      
      // Ensure subject doesn't stack "Re:" prefixes (Gmail threading requirement)
      let replySubject = thread.subject || 'Follow-up';
      if (replySubject && !replySubject.toLowerCase().startsWith('re:')) {
        replySubject = `Re: ${replySubject}`;
      }
      
      const emailResult = await resend.emails.send({
        from: formattedFrom,
        to: company.email,
        subject: replySubject,
        text: emailBody,
        replyTo: thread.replyToEmail || undefined,
        headers: Object.keys(emailHeaders).length > 0 ? emailHeaders : undefined
      });

      let email: Email;
      
      // If approving an existing draft, update it instead of creating new record
      if (options?.existingDraftId) {
        email = await storage.updateEmail(options.existingDraftId, {
          messageId: emailResult.data?.id || '',
          status: 'sent',
          sentAt: new Date(),
          body: emailBody
        });
        console.log(`✅ Draft ${options.existingDraftId} approved and sent`);
      } else {
        email = await storage.createEmail({
          threadId: thread.id,
          messageId: emailResult.data?.id || '',
          direction: 'outbound',
          subject: replySubject,
          body: emailBody,
          metadata: options?.questionIds ? { questionIds: options.questionIds } : null,
          sentAt: new Date(),
          status: 'sent',
          authorType: 'user'
        });
      }

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
      
      // Get recent messages (from last 7 days for comprehensive coverage)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateQuery = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;
      
      const messages = await gmail.users.messages.list({
        userId: 'me',
        q: dateQuery,
        maxResults: 50  // Increased for 7-day window
      });

      const messagesFound = messages.data.messages?.length || 0;
      console.log(`📨 Checking inbox: Found ${messagesFound} messages in last 7 days`);

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
      const emailMessageId = headers.find((h: any) => h.name === 'Message-ID' || h.name === 'Message-Id')?.value || '';
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
      
      // Parse reply to remove quoted conversation history
      body = parseEmailReply(body);

      // Collect ALL attachments for classification (including non-PDFs)
      const allAttachments: { fileName: string; mimeType: string }[] = [];
      if (message.data.payload?.parts) {
        for (const part of message.data.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            allAttachments.push({
              fileName: part.filename,
              mimeType: part.mimeType || ''
            });
          }
        }
      }
      console.log(`[Email] Found ${allAttachments.length} attachments:`, allAttachments.map(a => a.fileName).join(', '));

      // ========================================
      // BATCH PDF PROCESSING (Race Condition Fix)
      // ========================================
      // Process ALL PDFs from email before running comparison.
      // This ensures comparison includes all policies from a single offer email.
      // 
      // PHASE 1: Collect and save all PDFs, run extraction for each
      // PHASE 2: Run health checks for all documents
      // PHASE 3: Run ComparisonOrchestrator ONCE after ALL PDFs are processed
      // ========================================
      
      const seenHashesInThisEmail = new Set<string>();
      const { computeFileHash } = await import('../utils/hash');
      
      const attachments: any[] = [];
      let documentsCreated = 0;
      let duplicatesSkipped = 0;
      
      // Collect all processed documents for batch comparison
      const processedDocuments: { documentId: string; snapshotCount: number }[] = [];
      
      // PHASE 1: Download PDFs, run extraction pipeline for ALL
      if (message.data.payload?.parts) {
        console.log(`[Email Batch] Starting PHASE 1: PDF extraction for ${message.data.payload.parts.length} parts`);
        
        for (const part of message.data.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: part.body.attachmentId
            });
            
            if (attachment.data.data && part.filename.toLowerCase().endsWith('.pdf')) {
              const pdfBuffer = Buffer.from(attachment.data.data, 'base64');
              const fileHash = computeFileHash(pdfBuffer);
              
              // Check 1: Duplicate within same email
              if (seenHashesInThisEmail.has(fileHash)) {
                console.log(`[Email] Skipping duplicate PDF within same email`, { 
                  fileName: part.filename, 
                  fileHash: fileHash.substring(0, 8) + '...'
                });
                duplicatesSkipped++;
                continue;
              }
              seenHashesInThisEmail.add(fileHash);
              
              // Check 2: Duplicate across emails for same user+company (idempotent retry)
              if (existingThread.userId && existingThread.companyId) {
                const existingDoc = await storage.getOfferDocumentByUserCompanyAndHash(
                  existingThread.userId,
                  existingThread.companyId,
                  fileHash
                );
                if (existingDoc) {
                  console.log(`[Email] Skipping duplicate PDF (already processed)`, { 
                    fileName: part.filename, 
                    existingDocId: existingDoc.id,
                    fileHash: fileHash.substring(0, 8) + '...'
                  });
                  duplicatesSkipped++;
                  continue;
                }
              }
              
              // New unique PDF - save and process
              const fileName = `attachment_${Date.now()}_${part.filename}`;
              const filePath = path.join('uploads', fileName);
              
              fs.writeFileSync(filePath, pdfBuffer);
              
              // Create document with fileHash for future duplicate detection
              const document = await storage.createDocument({
                userId: existingThread.userId,
                fileName,
                filePath,
                fileSize: pdfBuffer.length,
                fileHash,
                ocrRawResponse: null,
                extractionStatus: 'pending',
                documentType: 'offer',
                companyId: existingThread.companyId
              });
              documentsCreated++;
              
              console.log(`[Email Batch] Document created: ${document.id} (${part.filename})`);
              
              // Run extraction pipeline (OCR → Segmentation → Per-segment Extraction)
              const { ExtractionOrchestratorService } = await import('./extractionOrchestratorService');
              const orchestrator = new ExtractionOrchestratorService(storage);
              const orchestratorResult = await orchestrator.processDocument(document.id);
              
              if (!orchestratorResult.success) {
                console.error(`[Email Batch] Extraction failed for ${document.id}:`, orchestratorResult.error);
                continue;
              }
              
              console.log(`[Email Batch] Extraction completed: ${orchestratorResult.snapshots.length} snapshots from ${part.filename}`);

              // Create policy records from OfferSnapshots (for legacy compatibility)
              for (const snapshot of orchestratorResult.snapshots) {
                await storage.createPolicy({
                  documentId: document.id,
                  userId: existingThread.userId ?? '',
                  companyId: snapshot.companyId || existingThread.companyId || null,
                  policyType: snapshot.policyType,
                  premium: snapshot.premium,
                  deductible: snapshot.deductible,
                  coverageDetails: snapshot.coverageDetails as any,
                  isOwnPolicy: false
                });
              }
              
              // Track for batch processing
              processedDocuments.push({
                documentId: document.id,
                snapshotCount: orchestratorResult.snapshots.length
              });
              
              attachments.push({ fileName, filePath });
            }
          }
        }
      }
      
      // PHASE 2: Run health checks for ALL documents
      if (processedDocuments.length > 0) {
        console.log(`[Email Batch] Starting PHASE 2: Health checks for ${processedDocuments.length} documents`);
        
        const { HealthCheckOrchestrator } = await import('./healthCheckOrchestrator');
        const healthCheckOrchestrator = new HealthCheckOrchestrator(storage);
        
        for (const doc of processedDocuments) {
          const healthCheckResult = await healthCheckOrchestrator.runForDocument(
            doc.documentId,
            {
              source: 'email_offer',
              userId: existingThread.userId ?? '',
              forceRerun: false
            }
          );
          
          console.log(`[Email Batch] Health check for ${doc.documentId}: ${healthCheckResult.healthChecksCreated} created`);
        }
      }
      
      // PHASE 3: Run ComparisonOrchestrator ONCE after ALL PDFs are processed
      // This ensures the comparison includes ALL policies from this offer email
      if (processedDocuments.length > 0 && existingThread.userId && existingThread.companyId) {
        const totalSnapshots = processedDocuments.reduce((sum, d) => sum + d.snapshotCount, 0);
        console.log(`[Email Batch] Starting PHASE 3: Running comparison for ${totalSnapshots} total snapshots from ${processedDocuments.length} documents`);
        
        const { ComparisonOrchestrator } = await import('./comparisonOrchestrator');
        const comparisonOrchestrator = new ComparisonOrchestrator(storage);
        
        const comparisonResult = await comparisonOrchestrator.runForUser({
          userId: existingThread.userId,
          forceRerun: true
        });
        
        console.log(`[Email Batch] PHASE 3 completed: ${comparisonResult.comparisonsCreated} comparisons created, ${comparisonResult.comparisonsFailed} failed`);
        
        if (comparisonResult.comparisonIds.length > 0) {
          console.log(`[Email Batch] ✅ Comparison IDs: ${comparisonResult.comparisonIds.join(', ')}`);
        }
      }
      
      // Log attachment processing summary
      if (duplicatesSkipped > 0 || documentsCreated > 0) {
        console.log(`[Email Batch] Processing complete`, { 
          documentsCreated, 
          duplicatesSkipped,
          totalPdfsInEmail: documentsCreated + duplicatesSkipped
        });
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

      // Record incoming email with proper status and author type
      await storage.createEmail({
        threadId: existingThread.id,
        messageId: messageId,
        emailMessageId: emailMessageId,
        direction: 'inbound',
        subject,
        body,
        attachments,
        sentAt: new Date(parseInt(message.data.internalDate || '0')),
        status: 'received',
        authorType: 'company'
      });

      // Update thread status
      await storage.updateEmailThread(existingThread.id, { status: 'received' });

      // Generate and send AI auto-response (for text-only replies)
      if (body && existingThread.companyId) {
        // Check user's AI auto-response preference
        const user = await storage.getUser(existingThread.userId ?? '');
        const aiEnabled = user?.aiAutoResponseEnabled !== false; // Default to true if not set
        
        if (!aiEnabled) {
          console.log(`[AI Auto-Response] Disabled for user ${existingThread.userId}`);
        } else {
          // Use new classifier to determine response mode
          // Use allAttachments (not just PDFs) so classifier correctly identifies emails with non-PDF attachments
          const { classifyIncomingEmailForAutoResponse } = await import('./aiResponseService');
          const responseMode = classifyIncomingEmailForAutoResponse({
            body,
            attachments: allAttachments
          });
          
          console.log(`[AI Auto-Response] Classified email as: ${responseMode}`);
          
          // Only proceed if mode is not 'none'
          if (responseMode !== 'none') {
            try {
              const company = await storage.getCompany(existingThread.companyId);
              
              if (company) {
                let responseText: string;
                
                // Handle 'request_pdf' mode with deterministic response (no AI)
                if (responseMode === 'request_pdf') {
                  console.log(`[Auto-Response] Sending deterministic PDF request to ${company.name} (no attachments)`);
                  responseText = generateRequestPdfAutoResponse(company.name);
                } else if (responseMode === 'request_pdf_has_files') {
                  console.log(`[Auto-Response] Sending deterministic PDF request to ${company.name} (has non-PDF files)`);
                  responseText = generateRequestPdfHasFilesAutoResponse(company.name);
                } else {
                  // Generate AI response for 'normal' and 'mitid' modes
                  console.log(`[AI Auto-Response] Generating ${responseMode} response for thread ${existingThread.id}`);
                  const conversationHistory = await storage.getThreadEmails(existingThread.id);
                  
                  responseText = await aiResponseService.generateResponse({
                    userId: existingThread.userId ?? '',
                    companyName: company.name,
                    threadId: existingThread.id,
                    incomingMessage: body,
                    conversationHistory: conversationHistory.map(e => ({
                      direction: e.direction || '',
                      body: e.body || '',
                      sentAt: e.sentAt || new Date()
                    })),
                    responseMode
                  });
                }

                // DRAFT SYSTEM: Always create drafts for user approval instead of auto-sending
                // Check if AI flagged for human review (special case)
                const needsReview = responseText.includes('DO NOT RESPOND - FLAG FOR HUMAN REVIEW');
                
                if (needsReview) {
                  console.log(`[AI Draft] Flagged for human review, creating draft`);
                }
                
                // Create draft for user approval (never auto-send)
                const draftEmail = await storage.createEmail({
                  threadId: existingThread.id,
                  messageId: '',
                  direction: 'auto',
                  subject: needsReview ? `[NEEDS REVIEW] Re: ${subject}` : `Re: ${subject}`,
                  body: responseText,
                  attachments: [],
                  sentAt: new Date(),
                  status: 'draft',
                  authorType: 'ai',
                  classifierLabel: responseMode
                });

                console.log(`[AI Draft] Created draft ${draftEmail.id} for user approval (mode: ${responseMode})`);
                console.log(`[AI Draft] User can approve at: /emails/${existingThread.id}`);
                
                // Update thread status to indicate there's a pending draft
                await storage.updateEmailThread(existingThread.id, { 
                  status: 'draft_pending',
                  aiMode: 'draft'
                });
              }
            } catch (error) {
              console.error('[Auto-Response] Failed to generate/send response:', error);
              // Continue processing - don't fail the whole inbox check
            }
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
