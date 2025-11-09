import { Mistral } from '@mistralai/mistralai';
import OpenAI from 'openai';
import fs from 'fs';
import { loadPrompt, replaceVariables } from '../ai-prompts/utils/promptLoader';

if (!process.env.MISTRAL_API_KEY) {
  throw new Error("MISTRAL_API_KEY environment variable is required");
}

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_API_KEY
});

// OpenAI is optional - used as fallback when available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000,
      maxRetries: 2
    })
  : null;

export interface InsuranceData {
  companyName: string;
  policyType: string;
  annualPremium: number;
  deductible: number;
  coverages: {
    name: string;
    amount?: number;
    description?: string;
  }[];
  benefits: string[];
  policyNumber?: string;
  validFrom?: string;
  validTo?: string;
}

export interface ExtractedPolicy {
  type: string;
  company: string;
  premium?: number;
  deductible?: number;
  coverages?: {
    name: string;
    amount?: number;
    description?: string;
  }[];
  benefits?: string[];
  pageRange?: string;
  policyNumber?: string;
  validFrom?: string;
  validTo?: string;
}

export interface PolicyExtractionResult {
  policies: ExtractedPolicy[];
  rawOcrResponse: any;
}

export class MistralOCRService {
  private async encodePdfToBase64(pdfPath: string): Promise<string> {
    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      return pdfBuffer.toString('base64');
    } catch (error) {
      console.error(`[Mistral OCR] Error encoding PDF: ${error}`);
      throw new Error(`Failed to encode PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getPdfPageCount(pdfPath: string): Promise<number> {
    try {
      // Note: pdf-parse v1 has import issues in ES modules
      // Skipping page count validation for now - keyword validation is more reliable
      console.log(`[Mistral OCR] Page count validation skipped (import limitations)`);
      return 0;
    } catch (error) {
      console.warn(`[Mistral OCR] Could not extract PDF page count: ${error}`);
      return 0;
    }
  }

  private validateOcrCompleteness(
    markdown: string, 
    expectedPageCount: number, 
    extractedPageCount: number
  ): { isComplete: boolean; issues: string[]; qualityScore: number } {
    const issues: string[] = [];
    let qualityScore = 100;
    
    // Check 1: Page count mismatch
    if (expectedPageCount > 0 && extractedPageCount < expectedPageCount) {
      issues.push(`OCR extracted only ${extractedPageCount}/${expectedPageCount} pages`);
      qualityScore -= 20;
    }
    
    // Check 2: Minimum content length (multi-policy PDFs should be substantial)
    if (markdown.length < 1000) {
      issues.push(`OCR output too short (${markdown.length} chars) - likely incomplete`);
      qualityScore -= 30;
    }
    
    // Check 3: Price/token density (should have reasonable number of kr amounts)
    const priceMatches = markdown.match(/\d[\d\s.,]+\s*kr/gi);
    const priceCount = priceMatches ? priceMatches.length : 0;
    if (priceCount < 3) {
      issues.push(`Very low price density (${priceCount} kr amounts found) - likely truncated`);
      qualityScore -= 25;
    }
    
    // Check 4: Content variety (not just repeated lines)
    const lines = markdown.split('\n').filter(l => l.trim().length > 0);
    const uniqueLines = new Set(lines);
    const varietyRatio = uniqueLines.size / Math.max(lines.length, 1);
    
    if (varietyRatio < 0.3 && lines.length > 10) {
      issues.push(`Low content variety (${Math.round(varietyRatio * 100)}% unique lines) - likely truncated/repeated`);
      qualityScore -= 25;
    }
    
    // Check 5: Detect policy keywords (just for logging, not a failure)
    const policyKeywords = [
      { pattern: /Fritidshusforsikring|fritidshus/i, name: 'Fritidshusforsikring' },
      { pattern: /Ulykkesforsikring/i, name: 'Ulykkesforsikring' },
      { pattern: /Indboforsikring/i, name: 'Indboforsikring' }
    ];
    
    const detectedPolicies = policyKeywords
      .filter(k => k.pattern.test(markdown))
      .map(k => k.name);
    
    console.log(`[Mistral OCR] Validation: Detected ${detectedPolicies.length} policy types: ${detectedPolicies.join(', ')}`);
    console.log(`[Mistral OCR] Validation: Quality score: ${qualityScore}/100`);
    console.log(`[Mistral OCR] Validation: Price density: ${priceCount} kr amounts, Content variety: ${Math.round(varietyRatio * 100)}%`);
    
    // Consider OCR complete if quality score is reasonable (>50)
    // This allows AI extraction to proceed even with imperfect OCR
    const isComplete = qualityScore > 50;
    
    return {
      isComplete,
      issues,
      qualityScore
    };
  }

  private async extractWithOpenAIVision(filePath: string): Promise<string> {
    console.log(`[OpenAI Fallback] Starting PDF extraction using Assistants API...`);
    
    if (!openai) {
      throw new Error("OpenAI client not initialized - OPENAI_API_KEY not available");
    }
    
    let uploadedFileId: string | null = null;
    let threadId: string | null = null;
    
    try {
      // Step 1: Upload PDF to OpenAI storage
      console.log(`[OpenAI Fallback] Uploading PDF file...`);
      const fileStream = fs.createReadStream(filePath);
      
      const uploadedFile = await openai.files.create({
        file: fileStream,
        purpose: "assistants"
      });
      
      uploadedFileId = uploadedFile.id;
      console.log(`[OpenAI Fallback] ✅ File uploaded: ${uploadedFileId}`);
      
      // Step 2: Create an assistant for OCR extraction
      console.log(`[OpenAI Fallback] Creating assistant...`);
      const assistant = await openai.beta.assistants.create({
        name: "Insurance PDF OCR Extractor",
        instructions: `You are an expert OCR system for Danish insurance documents. Extract ALL text from PDF files, preserving exact formatting, tables, and pricing patterns.

CRITICAL INSTRUCTIONS:
1. Include ALL policy sections (Fritidshusforsikring, Ulykkesforsikring, Indboforsikring)
2. Preserve ALL Danish pricing patterns with exact amounts:
   - "Din pris pr. år: X.XXX,XX kr"
   - "Månedlig pris er: X.XXX,XX kr"
   - "Årlig pris inklusiv: X.XXX,XX kr"
3. For each policy type, FIND and INCLUDE the annual price even if the label is different
4. Output as plain text with clear section breaks between policies
5. Use markdown formatting for structure`,
        model: "gpt-4o-mini",
        tools: [{ type: "file_search" }]
      });
      
      console.log(`[OpenAI Fallback] ✅ Assistant created: ${assistant.id}`);
      
      // Step 3: Create a thread with the uploaded file
      console.log(`[OpenAI Fallback] Creating thread with file attachment...`);
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: "Extract all text from the attached PDF file. Follow your instructions exactly.",
            attachments: [
              {
                file_id: uploadedFileId,
                tools: [{ type: "file_search" }]
              }
            ]
          }
        ]
      });
      
      threadId = thread.id;
      console.log(`[OpenAI Fallback] ✅ Thread created: ${threadId}`);
      
      // Step 4: Run the assistant
      console.log(`[OpenAI Fallback] Starting assistant run...`);
      let run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistant.id
      });
      
      // Step 5: Poll until run completes
      console.log(`[OpenAI Fallback] Polling run status...`);
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts × 2 seconds = 2 minutes max
      
      while (run.status === 'queued' || run.status === 'in_progress') {
        if (attempts >= maxAttempts) {
          throw new Error(`Run timed out after ${maxAttempts * 2} seconds`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        run = await openai.beta.threads.runs.retrieve(threadId!, run.id);
        attempts++;
        
        if (attempts % 5 === 0) {
          console.log(`[OpenAI Fallback] Run status: ${run.status} (${attempts * 2}s elapsed)`);
        }
      }
      
      console.log(`[OpenAI Fallback] Run completed with status: ${run.status}`);
      
      if (run.status !== 'completed') {
        throw new Error(`Run failed with status: ${run.status}`);
      }
      
      // Step 6: Retrieve messages from the thread
      console.log(`[OpenAI Fallback] Retrieving extracted text...`);
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Get the assistant's response (most recent message)
      const assistantMessages = messages.data.filter(m => m.role === 'assistant');
      if (assistantMessages.length === 0) {
        throw new Error("No assistant response found");
      }
      
      // Extract text content from the assistant's message
      const textContents = assistantMessages[0].content.filter(c => c.type === 'text');
      const extractedText = textContents.map(c => c.type === 'text' ? c.text.value : '').join('\n\n');
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("Assistant returned empty response");
      }
      
      console.log(`[OpenAI Fallback] ✅ Successfully extracted ${extractedText.length} characters`);
      
      // Step 7: Clean up assistant
      try {
        await openai.beta.assistants.delete(assistant.id);
        console.log(`[OpenAI Fallback] ✅ Cleaned up assistant`);
      } catch (cleanupError: any) {
        console.warn(`[OpenAI Fallback] ⚠️ Failed to delete assistant: ${cleanupError.message}`);
      }
      
      return extractedText;
      
    } catch (error: any) {
      console.error(`[OpenAI Fallback] Extraction failed: ${error.message || error}`);
      throw new Error(`OpenAI fallback failed: ${error.message || error}`);
    } finally {
      // Clean up resources
      if (uploadedFileId) {
        try {
          await openai.files.delete(uploadedFileId);
          console.log(`[OpenAI Fallback] ✅ Cleaned up uploaded file`);
        } catch (deleteError: any) {
          console.warn(`[OpenAI Fallback] ⚠️ Failed to delete file: ${deleteError.message}`);
        }
      }
    }
  }

  async extractInsuranceDataFromPDF(filePath: string): Promise<PolicyExtractionResult> {
    const MAX_RETRIES = 2;
    
    try {
      console.log(`[Mistral OCR] Starting extraction for: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Step 0: Get PDF metadata for validation
      const expectedPageCount = await this.getPdfPageCount(filePath);
      console.log(`[Mistral OCR] PDF contains ${expectedPageCount} pages (from metadata)`);

      // Encode PDF once for all attempts
      console.log(`[Mistral OCR] Encoding PDF to base64...`);
      const base64Pdf = await this.encodePdfToBase64(filePath);
      
      let extractedMarkdown = '';
      let ocrResponse: any;
      let validationResult: { isComplete: boolean; issues: string[] } | null = null;

      // Retry loop for OCR extraction
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[Mistral OCR] Attempt ${attempt}/${MAX_RETRIES}: Sending to Mistral OCR API...`);
        
        ocrResponse = await mistral.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            type: "document_url",
            documentUrl: `data:application/pdf;base64,${base64Pdf}`
          },
          includeImageBase64: false
        });

        if (!ocrResponse.pages || ocrResponse.pages.length === 0) {
          console.warn(`[Mistral OCR] Attempt ${attempt}: No pages extracted`);
          if (attempt < MAX_RETRIES) {
            console.log(`[Mistral OCR] Retrying...`);
            continue;
          }
          throw new Error("No pages extracted from PDF after retries");
        }

        // Combine all pages' markdown content
        extractedMarkdown = ocrResponse.pages
          .map((page: any) => page.markdown)
          .join('\n\n---\n\n');
        
        const extractedPageCount = ocrResponse.pages.length;
        console.log(`[Mistral OCR] Attempt ${attempt}: Extracted ${extractedPageCount} pages, total length: ${extractedMarkdown.length} characters`);
        
        // Validate OCR completeness
        validationResult = this.validateOcrCompleteness(
          extractedMarkdown,
          expectedPageCount,
          extractedPageCount
        );

        if (validationResult.isComplete) {
          console.log(`[Mistral OCR] ✅ Validation passed on attempt ${attempt}`);
          break;
        } else {
          console.warn(`[Mistral OCR] ⚠️ Validation failed on attempt ${attempt}:`);
          validationResult.issues.forEach(issue => console.warn(`   - ${issue}`));
          
          if (attempt < MAX_RETRIES) {
            console.log(`[Mistral OCR] Retrying due to validation failures...`);
          } else {
            console.error(`[Mistral OCR] ❌ All ${MAX_RETRIES} attempts failed validation`);
            
            // Try OpenAI Vision fallback if available
            if (openai) {
              console.log(`[Mistral OCR] 🔄 Activating OpenAI Vision API fallback...`);
              
              try {
                // Use OpenAI Vision as fallback
                extractedMarkdown = await this.extractWithOpenAIVision(filePath);
                console.log(`[OpenAI Vision] ✅ Fallback extraction successful`);
                
                // Revalidate with OpenAI Vision output
                validationResult = this.validateOcrCompleteness(
                  extractedMarkdown,
                  expectedPageCount,
                  0 // OpenAI Vision doesn't return page count
                );
                
                if (validationResult.isComplete) {
                  console.log(`[OpenAI Vision] ✅ Validation passed after fallback`);
                } else {
                  console.warn(`[OpenAI Vision] ⚠️ Validation still has issues after fallback:`);
                  validationResult.issues.forEach(issue => console.warn(`   - ${issue}`));
                  console.log(`[OpenAI Vision] Proceeding with best available data`);
                }
              } catch (fallbackError) {
                console.error(`[OpenAI Vision] Fallback failed: ${fallbackError}`);
                console.error(`[Mistral OCR] Proceeding with Mistral data despite validation issues`);
              }
            } else {
              console.warn(`[Mistral OCR] ⚠️ OpenAI Vision fallback unavailable (OPENAI_API_KEY not set)`);
              console.warn(`[Mistral OCR] Proceeding with incomplete Mistral data`);
            }
          }
        }
      }

      if (!extractedMarkdown || extractedMarkdown.trim().length === 0) {
        throw new Error("No text could be extracted from PDF");
      }

      // Preprocessing: Fix Danish pricing patterns split by dotted leaders and line breaks
      // OCR often renders "Din pris pr. år ................ <br> 3.154,04 kr" with price on next line
      // We need to merge them: "Din pris pr. år: 3.154,04 kr"
      // Only match when there are dots (.) before <br> to avoid false matches
      const preprocessedMarkdown = extractedMarkdown
        .replace(/Din pris pr\. år[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Din pris pr. år: $1 kr')
        .replace(/Månedlig pris er[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Månedlig pris er: $1 kr')
        .replace(/Årlig pris inklusiv[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Årlig pris inklusiv: $1 kr');
      
      console.log('[Mistral OCR] Applied pricing pattern preprocessing (dotted leaders only)');

      // Step 2: Use Mistral Chat to structure the extracted markdown
      console.log(`[Mistral OCR] Sending to Mistral Chat for structured extraction...`);
      
      const systemPrompt = loadPrompt('ocr/policy-extraction');
      const userPrompt = replaceVariables(systemPrompt, {
        extractedMarkdown: preprocessedMarkdown
      });
      
      const chatResponse = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 4096,
      });

      const choice = chatResponse.choices?.[0];
      const rawContent = choice?.message?.content;
      
      // Handle both string and ContentChunk[] types
      const content = typeof rawContent === 'string' 
        ? rawContent 
        : Array.isArray(rawContent) 
          ? rawContent.map(chunk => 
              'text' in chunk ? chunk.text : ''
            ).join('') 
          : '';
      
      console.log(`[Mistral OCR] Chat finish_reason: ${choice?.finishReason}`);
      console.log(`[Mistral OCR] Response content length: ${content?.length || 0}`);
      console.log(`[Mistral OCR] Response content preview: ${content?.substring(0, 500) || 'NULL'}`);
      
      if (!content || content.trim().length === 0) {
        console.error(`[Mistral OCR] Mistral Chat returned empty content!`);
        throw new Error("Mistral Chat returned empty response");
      }
      
      let result = JSON.parse(content);
      console.log(`[Mistral OCR] Successfully extracted ${result.policies?.length || 0} policies`);
      
      // Post-extraction validation: Check for missing critical fields (premiums/deductibles)
      const policiesWithMissingData = (result.policies || []).filter((policy: any) => 
        policy.premium === null || policy.premium === undefined || policy.premium === 0
      );
      
      if (policiesWithMissingData.length > 0) {
        console.warn(`[Mistral OCR] ⚠️ Post-extraction validation: ${policiesWithMissingData.length} policies missing premiums:`);
        policiesWithMissingData.forEach((p: any) => {
          console.warn(`   - ${p.type}: premium = ${p.premium}`);
        });
        
        // Trigger OpenAI Vision fallback if available
        if (openai) {
          console.log(`[Mistral OCR] 🔄 Activating OpenAI Vision fallback due to missing policy premiums...`);
          
          try {
            // Use OpenAI Vision as fallback
            const visionMarkdown = await this.extractWithOpenAIVision(filePath);
            console.log(`[OpenAI Vision] ✅ Fallback extraction successful`);
            
            // Reprocess with Vision markdown
            const visionPreprocessed = visionMarkdown
              .replace(/Din pris pr\. år[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Din pris pr. år: $1 kr')
              .replace(/Månedlig pris er[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Månedlig pris er: $1 kr')
              .replace(/Årlig pris inklusiv[^\n<]*?\.{3,}[^\n<]*?<br>\s*(\d[\d\s.,]*)\s*kr/gi, 'Årlig pris inklusiv: $1 kr');
            
            console.log('[OpenAI Vision] Applied pricing pattern preprocessing');
            console.log('[OpenAI Vision] Sending to Mistral Chat for structured extraction...');
            
            const visionPrompt = replaceVariables(systemPrompt, {
              extractedMarkdown: visionPreprocessed
            });
            
            const visionChatResponse = await mistral.chat.complete({
              model: "mistral-large-latest",
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: visionPrompt
                },
              ],
              responseFormat: { type: "json_object" },
              maxTokens: 4096,
            });
            
            const visionChoice = visionChatResponse.choices?.[0];
            const visionRawContent = visionChoice?.message?.content;
            const visionContent = typeof visionRawContent === 'string' 
              ? visionRawContent 
              : Array.isArray(visionRawContent) 
                ? visionRawContent.map(chunk => 'text' in chunk ? chunk.text : '').join('') 
                : '';
            
            if (visionContent && visionContent.trim().length > 0) {
              const visionResult = JSON.parse(visionContent);
              console.log(`[OpenAI Vision] Extracted ${visionResult.policies?.length || 0} policies from Vision fallback`);
              
              // Check Vision result for missing premiums
              const visionMissingData = (visionResult.policies || []).filter((policy: any) => 
                policy.premium === null || policy.premium === undefined || policy.premium === 0
              );
              
              if (visionMissingData.length < policiesWithMissingData.length) {
                console.log(`[OpenAI Vision] ✅ Fallback improved results (${policiesWithMissingData.length - visionMissingData.length} more premiums found)`);
                result = visionResult;
              } else {
                console.warn(`[OpenAI Vision] ⚠️ Fallback did not improve results, using best available data`);
              }
              
              if (visionMissingData.length > 0) {
                console.warn(`[OpenAI Vision] Still missing premiums for:`);
                visionMissingData.forEach((p: any) => console.warn(`   - ${p.type}`));
              }
            } else {
              console.error(`[OpenAI Vision] Extraction returned empty content, using Mistral data`);
            }
          } catch (visionError: any) {
            console.error(`[OpenAI Vision] Fallback failed: ${visionError.message || visionError}`);
            console.error(`[Mistral OCR] Proceeding with Mistral data despite missing premiums`);
          }
        } else {
          console.warn(`[Mistral OCR] ⚠️ OpenAI Vision fallback unavailable (OPENAI_API_KEY not set)`);
          console.warn(`[Mistral OCR] Proceeding with incomplete data - ${policiesWithMissingData.length} policies missing premiums`);
        }
      } else {
        console.log(`[Mistral OCR] ✅ Post-extraction validation: All policies have premiums`);
      }
      
      return {
        policies: result.policies || [],
        rawOcrResponse: ocrResponse
      };
    } catch (error) {
      console.error("[Mistral OCR] Extraction failed:", error);
      throw new Error(`Failed to extract insurance data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const base64Pdf = await this.encodePdfToBase64(filePath);
      
      const ocrResponse = await mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: `data:application/pdf;base64,${base64Pdf}`
        },
        includeImageBase64: false
      });

      if (!ocrResponse.pages || ocrResponse.pages.length === 0) {
        throw new Error("No pages extracted from PDF");
      }

      return ocrResponse.pages
        .map(page => page.markdown)
        .join('\n\n---\n\n');
    } catch (error) {
      console.error("[Mistral OCR] Text extraction failed:", error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const mistralOcrService = new MistralOCRService();
