import { ExtractedPolicy } from "../services/mistralOcrService";
import { InsertPolicy } from "../../shared/schema";

export function parsePolicyType(typeString: string): string {
  if (!typeString) return "other";
  
  const normalized = typeString.toLowerCase().trim();
  
  if (normalized.includes("indboforsikring") || normalized.includes("indbo") || normalized.includes("contents")) {
    return "indbo";
  }
  
  if (normalized.includes("ulykkesforsikring") || normalized.includes("ulykke") || normalized.includes("accident")) {
    return "ulykke";
  }
  
  if (normalized.includes("husforsikring") || normalized.includes("hus") || normalized.includes("home") || normalized.includes("house")) {
    return "hus";
  }
  
  if (normalized.includes("bilforsikring") || normalized.includes("bil") || normalized.includes("car") || normalized.includes("auto")) {
    return "bil";
  }
  
  if (normalized.includes("rejseforsikring") || normalized.includes("rejse") || normalized.includes("travel")) {
    return "rejse";
  }
  
  return "other";
}

export function calculateExtractionConfidence(policy: ExtractedPolicy): number {
  let confidence = 0;
  
  if (policy.premium && policy.premium > 0) {
    confidence += 30;
  }
  
  if (policy.deductible && policy.deductible > 0) {
    confidence += 20;
  }
  
  if (policy.company && policy.company.trim().length > 0) {
    confidence += 20;
  }
  
  if (policy.coverages && policy.coverages.length > 0) {
    confidence += 20;
  }
  
  if (policy.pageRange && policy.pageRange.trim().length > 0) {
    confidence += 10;
  }
  
  return confidence;
}

export function convertToPolicyRecord(
  extracted: ExtractedPolicy,
  documentId: string,
  userId: string,
  companyId?: string
): InsertPolicy {
  const policyType = parsePolicyType(extracted.type);
  const confidence = calculateExtractionConfidence(extracted);
  
  const coverageDetails = {
    type: extracted.type,
    company: extracted.company,
    coverages: extracted.coverages || [],
    benefits: extracted.benefits || [],
    policyNumber: extracted.policyNumber,
    validFrom: extracted.validFrom,
    validTo: extracted.validTo,
  };
  
  return {
    documentId,
    userId,
    companyId: companyId || null,
    policyType,
    isOwnPolicy: true,
    premium: extracted.premium || null,
    deductible: extracted.deductible || null,
    coverageDetails,
    sourcePageRange: extracted.pageRange || null,
    extractionConfidence: confidence,
    healthCheckStatus: "pending",
    healthCheckPayload: null,
    healthCheckSavingsAnnual: null,
    healthCheckUpdatedAt: null,
  };
}
