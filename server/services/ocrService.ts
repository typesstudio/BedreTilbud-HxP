import OpenAI from "openai";
import fs from "fs";
import path from "path";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
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
      // Convert PDF to base64 - in production, you'd use a PDF to image conversion library
      // For now, we'll assume the file is already processed or use OCR directly
      const fileBuffer = fs.readFileSync(filePath);
      const base64Image = fileBuffer.toString('base64');

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting insurance policy information from documents. Extract key information and return it in JSON format with these fields:
            - companyName: string
            - policyType: string (e.g., "Bilforsikring", "Indboforsikring", "Rejseforsikring")
            - annualPremium: number (yearly cost in DKK)
            - deductible: number (selvrisiko in DKK)
            - coverages: array of {name: string, amount?: number, description?: string}
            - benefits: array of strings
            - policyNumber: string (optional)
            - validFrom: string (optional, ISO date)
            - validTo: string (optional, ISO date)
            
            If document is in Danish, translate coverage names to Danish. Return all monetary amounts in DKK.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract insurance policy information from this document:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as InsuranceData;
    } catch (error) {
      console.error("OCR extraction failed:", error);
      throw new Error(`Failed to extract insurance data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64Image = fileBuffer.toString('base64');

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this document and return it as plain text:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        max_completion_tokens: 4096,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Text extraction failed:", error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const ocrService = new OCRService();
