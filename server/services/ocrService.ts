import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

// Load CommonJS module in ESM environment
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (dataBuffer: Buffer) => Promise<{text: string; numpages: number; info: any; metadata: any; version: string}>;

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
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

export class OCRService {
  async extractInsuranceDataFromPDF(filePath: string): Promise<InsuranceData> {
    try {
      console.log(`[OCR] Starting extraction for: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Extract text from PDF
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`[OCR] Read file buffer, size: ${fileBuffer.length} bytes`);
      
      const pdfData = await pdfParse(fileBuffer);
      const extractedText = pdfData.text;
      console.log(`[OCR] Extracted text length: ${extractedText.length} characters`);
      console.log(`[OCR] Text preview: ${extractedText.substring(0, 200)}...`);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("No text could be extracted from PDF");
      }

      // Use OpenAI to structure the extracted text
      console.log(`[OCR] Sending to OpenAI GPT-4 for structured extraction...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
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
            4. All amounts must be numbers in DKK`
          },
          {
            role: "user",
            content: `Extract insurance policy information from this text:\n\n${extractedText}`
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      console.log(`[OCR] Full OpenAI response:`, JSON.stringify(response, null, 2));
      const choice = response.choices[0];
      const content = choice?.message?.content;
      
      console.log(`[OCR] Choice finish_reason: ${choice?.finish_reason}`);
      console.log(`[OCR] Response content length: ${content?.length || 0}`);
      console.log(`[OCR] Response content preview: ${content?.substring(0, 500) || 'NULL'}`);
      
      if (choice?.message?.refusal) {
        console.error(`[OCR] OpenAI refusal: ${choice.message.refusal}`);
        throw new Error(`OpenAI refused request: ${choice.message.refusal}`);
      }
      
      if (!content || content.trim().length === 0) {
        console.error(`[OCR] OpenAI returned empty content!`);
        throw new Error("OpenAI returned empty response");
      }
      
      const result = JSON.parse(content);
      console.log(`[OCR] Successfully extracted data with ${Object.keys(result).length} fields`);
      
      return result as InsuranceData;
    } catch (error) {
      console.error("[OCR] Extraction failed:", error);
      throw new Error(`Failed to extract insurance data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);
      return pdfData.text;
    } catch (error) {
      console.error("Text extraction failed:", error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const ocrService = new OCRService();
