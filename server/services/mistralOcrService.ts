import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';

const mistral = new Mistral({ 
  apiKey: process.env.MISTRAL_API_KEY || ""
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

  async extractInsuranceDataFromPDF(filePath: string): Promise<InsuranceData> {
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

      // Step 2: Use Mistral Chat to structure the extracted markdown
      console.log(`[Mistral OCR] Sending to Mistral Chat for structured extraction...`);
      const chatResponse = await mistral.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting insurance policy information from documents. Extract key information and return it in EXACTLY this JSON format:
            
            {
              "companyName": "string",
              "policyType": "string",
              "annualPremium": number,
              "deductible": number,
              "coverages": [{name: "string", amount: number, description: "string"}],
              "benefits": ["string"],
              "policyNumber": "string",
              "validFrom": "YYYY-MM-DD",
              "validTo": "YYYY-MM-DD"
            }
            
            CRITICAL RULES:
            1. If document contains multiple policies (e.g., Fritidshus + Indbo + Ulykke), COMBINE them:
               - policyType: "Fritidshusforsikring, Indboforsikring, Ulykkesforsikring"
               - annualPremium: sum all premiums (e.g., 5682.13 + 3154.04 + 995.10 = 9831.27)
               - deductible: use highest value
               - coverages: merge ALL coverages into ONE flat array
               - benefits: merge ALL benefits into ONE flat array
            
            2. NEVER create nested structures, arrays of policies, or policyTypes field
            3. Keep all text in Danish if document is in Danish
            4. All amounts must be numbers in DKK
            5. Return ONLY the JSON object, no additional text`
          },
          {
            role: "user",
            content: `Extract insurance policy information from this markdown document:\n\n${extractedMarkdown}`
          },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 2048,
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
      console.log(`[Mistral OCR] Successfully extracted data with ${Object.keys(result).length} fields`);
      
      return result as InsuranceData;
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
