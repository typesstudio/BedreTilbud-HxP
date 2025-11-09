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
  ): { isComplete: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check 1: Page count mismatch
    if (expectedPageCount > 0 && extractedPageCount < expectedPageCount) {
      issues.push(`OCR extracted only ${extractedPageCount}/${expectedPageCount} pages`);
    }
    
    // Check 2: Mandatory Danish policy keywords and their annual prices
    const policyKeywords = [
      { pattern: /Fritidshusforsikring|fritidshus/i, name: 'Fritidshusforsikring', shortName: 'hus' },
      { pattern: /Ulykkesforsikring/i, name: 'Ulykkesforsikring', shortName: 'ulykke' },
      { pattern: /Indboforsikring/i, name: 'Indboforsikring', shortName: 'indbo' }
    ];
    
    const detectedPolicies: string[] = [];
    const policiesWithPricing: string[] = [];
    
    for (const keyword of policyKeywords) {
      if (keyword.pattern.test(markdown)) {
        detectedPolicies.push(keyword.name);
        
        // Extract the section for this policy
        const sectionMatch = markdown.match(new RegExp(
          `${keyword.pattern.source}[\\s\\S]{0,2000}?(?=Tilbud på din|Tilbud Fritidshusforsikring|Tilbud Ulykkesforsikring|Tilbud Indboforsikring|$)`,
          'i'
        ));
        
        if (sectionMatch) {
          const policySection = sectionMatch[0];
          
          // Check if this section has "Din pris pr. år" with an actual price
          const annualPricePattern = /Din pris pr\. år[^\n]*?(\d[\d\s.,]+)\s*kr/i;
          const hasPricing = annualPricePattern.test(policySection);
          
          if (hasPricing) {
            policiesWithPricing.push(keyword.name);
          } else {
            issues.push(`${keyword.name} section missing annual price (Din pris pr. år)`);
          }
        }
      }
    }
    
    // Check 3: Minimum content length (multi-policy PDFs should be substantial)
    if (markdown.length < 1000) {
      issues.push(`OCR output too short (${markdown.length} chars) - likely incomplete`);
    }
    
    console.log(`[Mistral OCR] Validation: Detected ${detectedPolicies.length} policy types: ${detectedPolicies.join(', ')}`);
    console.log(`[Mistral OCR] Validation: ${policiesWithPricing.length}/${detectedPolicies.length} policies have annual pricing`);
    if (policiesWithPricing.length > 0) {
      console.log(`[Mistral OCR] Validation: Policies with pricing: ${policiesWithPricing.join(', ')}`);
    }
    
    return {
      isComplete: issues.length === 0,
      issues
    };
  }

  private async extractWithOpenAIVision(filePath: string): Promise<string> {
    console.log(`[OpenAI Vision] Starting fallback OCR extraction...`);
    
    if (!openai) {
      throw new Error("OpenAI client not initialized - OPENAI_API_KEY not available");
    }
    
    try {
      const base64Pdf = await this.encodePdfToBase64(filePath);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this Danish insurance offer PDF. Preserve the exact formatting, pricing patterns (Din pris pr. år), and numerical values. Include ALL policy sections (Fritidshusforsikring, Ulykkesforsikring, Indboforsikring). Output as plain text with clear section breaks."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096
      });

      const extractedText = response.choices[0]?.message?.content || '';
      console.log(`[OpenAI Vision] Extracted ${extractedText.length} characters`);
      
      return extractedText;
    } catch (error) {
      console.error(`[OpenAI Vision] Extraction failed: ${error}`);
      throw new Error(`OpenAI Vision fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      const result = JSON.parse(content);
      console.log(`[Mistral OCR] Successfully extracted ${result.policies?.length || 0} policies`);
      
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
