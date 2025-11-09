import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import { loadPrompt, replaceVariables } from '../ai-prompts/utils/promptLoader';

if (!process.env.MISTRAL_API_KEY) {
  throw new Error("MISTRAL_API_KEY environment variable is required");
}

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_API_KEY
});

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

  async extractInsuranceDataFromPDF(filePath: string): Promise<PolicyExtractionResult> {
    try {
      console.log(`[Mistral OCR] Starting extraction for: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Step 1: Extract text using Mistral OCR
      console.log(`[Mistral OCR] Encoding PDF to base64...`);
      const base64Pdf = await this.encodePdfToBase64(filePath);
      
      console.log(`[Mistral OCR] Sending to Mistral OCR API...`);
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

      // Combine all pages' markdown content
      const extractedMarkdown = ocrResponse.pages
        .map(page => page.markdown)
        .join('\n\n---\n\n');
      
      console.log(`[Mistral OCR] Extracted ${ocrResponse.pages.length} pages, total length: ${extractedMarkdown.length} characters`);
      console.log(`[Mistral OCR] Preview: ${extractedMarkdown.substring(0, 200)}...`);

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
