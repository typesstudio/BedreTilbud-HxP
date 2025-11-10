import type { IStorage } from "../storage";
import type { InsertOfferSnapshot, OfferSnapshot } from "@shared/schema";

interface ExtractionStage {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: any;
}

interface ExtractionResult {
  success: boolean;
  documentId: string;
  snapshots: OfferSnapshot[];
  stages: ExtractionStage[];
  error?: string;
}

interface OcrOutput {
  markdown: string;
  pageCount: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

interface StructuredPolicy {
  policyType: string;
  companyName: string;
  premium: number | null;
  deductible: number | null;
  coverageDetails: any;
  sourcePageRange: string | null;
  confidence: number;
}

export class ExtractionOrchestratorService {
  private storage: IStorage;
  private version = "2.0.0";

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async processDocument(
    documentId: string,
    options: {
      forceReprocess?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<ExtractionResult> {
    const stages: ExtractionStage[] = [];
    
    console.log(`[Orchestrator] Starting extraction pipeline for document ${documentId}`);
    console.log(`[Orchestrator] Options:`, options);

    try {
      // Get document metadata
      const document = await this.storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Stage 1: OCR Extraction
      const ocrStage = this.createStage("ocr_extraction");
      stages.push(ocrStage);
      const ocrOutput = await this.runOcrStage(document, ocrStage);

      // Stage 2: Validation & Preprocessing
      const validationStage = this.createStage("validation");
      stages.push(validationStage);
      const validationResult = await this.runValidationStage(
        ocrOutput, 
        validationStage,
        options.skipValidation
      );

      // Stage 3: Structured Extraction (OpenAI)
      const extractionStage = this.createStage("structured_extraction");
      stages.push(extractionStage);
      const extractedPolicies = await this.runExtractionStage(
        ocrOutput,
        validationResult,
        extractionStage
      );

      // Stage 4: Create OfferSnapshots
      const snapshotStage = this.createStage("snapshot_creation");
      stages.push(snapshotStage);
      const snapshots = await this.runSnapshotCreationStage(
        document,
        extractedPolicies,
        ocrOutput,
        validationResult,
        snapshotStage
      );

      console.log(`[Orchestrator] Successfully created ${snapshots.length} OfferSnapshots`);

      return {
        success: true,
        documentId,
        snapshots,
        stages
      };

    } catch (error) {
      console.error(`[Orchestrator] Pipeline failed for document ${documentId}:`, error);
      return {
        success: false,
        documentId,
        snapshots: [],
        stages,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createStage(name: string): ExtractionStage {
    return {
      name,
      status: "pending",
      startedAt: undefined,
      completedAt: undefined
    };
  }

  private async runOcrStage(
    document: any,
    stage: ExtractionStage
  ): Promise<OcrOutput> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 1: Running OCR extraction...`);
      
      // Use existing Mistral OCR service
      const { MistralOCRService } = await import("./mistralOcrService");
      const ocrService = new MistralOCRService();
      
      const markdown = await ocrService.extractTextFromPDF(document.filePath);
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { markdownLength: markdown.length };
      
      console.log(`[Orchestrator] OCR completed: ${markdown.length} chars extracted`);
      
      return {
        markdown,
        pageCount: 0 // TODO: Extract from PDF metadata
      };
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async runValidationStage(
    ocrOutput: OcrOutput,
    stage: ExtractionStage,
    skipValidation?: boolean
  ): Promise<ValidationResult> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 2: Validating OCR output...`);
      
      if (skipValidation) {
        console.log(`[Orchestrator] Validation skipped by option`);
        stage.status = "completed";
        stage.completedAt = new Date();
        return {
          isValid: true,
          errors: [],
          warnings: ["Validation skipped"],
          confidence: 1.0
        };
      }

      // TODO: Implement proper validation logic
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Basic checks
      if (ocrOutput.markdown.length < 100) {
        errors.push("OCR output too short (< 100 characters)");
      }
      
      if (!ocrOutput.markdown.toLowerCase().includes("forsikring")) {
        warnings.push("No insurance-related keywords found");
      }

      const confidence = errors.length === 0 ? 0.8 : 0.3;
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { errors, warnings, confidence };
      
      console.log(`[Orchestrator] Validation completed: ${errors.length} errors, ${warnings.length} warnings`);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        confidence
      };
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async runExtractionStage(
    ocrOutput: OcrOutput,
    validationResult: ValidationResult,
    stage: ExtractionStage
  ): Promise<StructuredPolicy[]> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 3: Running structured extraction (OpenAI)...`);
      
      // TODO: Implement OpenAI structured extraction
      // For now, return empty to validate the pipeline structure
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { policiesExtracted: 0 };
      
      console.log(`[Orchestrator] Extraction completed: 0 policies (TODO: implement)`);
      
      return [];
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async runSnapshotCreationStage(
    document: any,
    policies: StructuredPolicy[],
    ocrOutput: OcrOutput,
    validationResult: ValidationResult,
    stage: ExtractionStage
  ): Promise<OfferSnapshot[]> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 4: Creating OfferSnapshots...`);
      
      const snapshots: OfferSnapshot[] = [];
      
      for (const policy of policies) {
        const insertData: InsertOfferSnapshot = {
          documentId: document.id,
          userId: document.userId,
          policyId: null, // Will be linked later during matching
          policyType: policy.policyType,
          companyId: null, // TODO: Resolve from company name
          premium: policy.premium !== null ? policy.premium.toString() : null,
          deductible: policy.deductible !== null ? policy.deductible.toString() : null,
          coverageDetails: policy.coverageDetails,
          extractionVersion: this.version,
          extractorModel: "gpt-4o-mini",
          extractorProvider: "openai",
          confidenceScore: policy.confidence,
          validationStatus: validationResult.isValid ? "validated" : "needs_review",
          validationErrors: validationResult.errors.length > 0 
            ? validationResult.errors 
            : null,
          sourcePageRange: policy.sourcePageRange,
          rawExtractedData: {
            ocrMarkdown: ocrOutput.markdown,
            validationWarnings: validationResult.warnings,
            extractedAt: new Date().toISOString()
          }
        };
        
        const snapshot = await this.storage.createOfferSnapshot(insertData);
        snapshots.push(snapshot);
      }
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { snapshotsCreated: snapshots.length };
      
      console.log(`[Orchestrator] Created ${snapshots.length} OfferSnapshots`);
      
      return snapshots;
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
}
