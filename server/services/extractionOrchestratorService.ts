import type { IStorage } from "../storage";
import type { InsertOfferSnapshot, OfferSnapshot } from "@shared/schema";
import { classifyDocumentKind, type DocumentClassificationResult } from "./documentClassifierService";

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

interface ExtractionStagesData {
  stage1_ocr?: {
    rawOutput: string;
    timestamp: string;
    metadata: {
      source: string;
      markdownLength: number;
      pageCount: number;
      latencyMs: number;
    };
  };
  stage2_segmentation?: {
    rawOutput: any[];
    timestamp: string;
    metadata: {
      segmentCount: number;
      modelUsed: string;
      tokensUsed: number;
      costUsd: number;
      latencyMs: number;
      confidenceScores: number[];
    };
  };
  stage3_extraction?: {
    rawOutput: StructuredPolicy[];
    timestamp: string;
    metadata: {
      policyCount: number;
      latencyMs: number;
      successCount: number;
      failureCount: number;
      errors?: string[];
    };
  };
}

type ExtractionStatus = "pending" | "processing" | "completed" | "failed";
type ErrorReason = 
  | "ocr_timeout" 
  | "ocr_rate_limited" 
  | "ocr_provider_error" 
  | "ocr_failed"
  | "json_parse_error" 
  | "segmentation_failed"
  | "extraction_failed"
  | "validation_failed"
  | "file_not_found"
  | "file_too_large"
  | "pdf_password_protected"
  | "pdf_corrupt"
  | "unknown_error";

function mapErrorToReason(error: unknown): ErrorReason {
  // Handle string errors, error.message, error.code, and error.toString()
  let message = "";
  
  if (typeof error === "string") {
    message = error.toLowerCase();
  } else if (error instanceof Error) {
    message = error.message.toLowerCase();
  } else if (error && typeof error === "object") {
    // Check for error.message, error.code, or try toString()
    const errorObj = error as any;
    if (errorObj.message) message = String(errorObj.message).toLowerCase();
    if (errorObj.code) message += " " + String(errorObj.code).toLowerCase();
    if (!message && errorObj.toString) message = String(errorObj.toString()).toLowerCase();
  }
  
  if (message.includes("timeout")) return "ocr_timeout";
  if (message.includes("rate limit") || message.includes("429")) return "ocr_rate_limited";
  if (message.includes("provider") || message.includes("api")) return "ocr_provider_error";
  if (message.includes("json") || message.includes("parse")) return "json_parse_error";
  if (message.includes("segment")) return "segmentation_failed";
  if (message.includes("extract")) return "extraction_failed";
  if (message.includes("valid")) return "validation_failed";
  if (message.includes("not found")) return "file_not_found";
  if (message.includes("too large") || message.includes("size")) return "file_too_large";
  if (message.includes("password") || message.includes("encrypted")) return "pdf_password_protected";
  if (message.includes("corrupt") || message.includes("invalid pdf")) return "pdf_corrupt";
  if (message.includes("ocr")) return "ocr_failed";
  
  return "unknown_error";
}

export class ExtractionOrchestratorService {
  private storage: IStorage;
  private version = "2.1.0"; // Updated for two-step pipeline
  private useTwoStepPipeline: boolean;
  private useTwoPhaseHealthCheck: boolean;
  private extractionStagesData: ExtractionStagesData = {}; // Accumulate stage data

  constructor(storage: IStorage) {
    this.storage = storage;
    this.useTwoStepPipeline = process.env.ENABLE_TWO_STEP_EXTRACTION !== 'false';
    this.useTwoPhaseHealthCheck = process.env.ENABLE_TWO_PHASE_HEALTHCHECK === 'true';
    console.log(`[Orchestrator] Two-step pipeline: ${this.useTwoStepPipeline ? 'ENABLED (v2.1.0)' : 'DISABLED (legacy v2.0.0)'}`);
    console.log(`[Orchestrator] Two-phase health check: ${this.useTwoPhaseHealthCheck ? 'ENABLED' : 'DISABLED'}`);
  }

  private async markDocumentStatus(
    documentId: string,
    status: ExtractionStatus,
    errorReason: ErrorReason | null = null,
    additionalUpdates: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.storage.updateDocument(documentId, {
        extractionStatus: status,
        errorReason: status === "failed" ? errorReason : null,
        ...additionalUpdates
      });
      console.log(`[Orchestrator] Document ${documentId} status updated to: ${status}${errorReason ? ` (reason: ${errorReason})` : ''}`);
    } catch (updateError) {
      console.error(`[Orchestrator] Failed to update document status:`, updateError);
    }
  }

  private async persistStageData(documentId: string): Promise<void> {
    try {
      await this.storage.updateDocumentExtractionStages(documentId, this.extractionStagesData);
      console.log(`[Orchestrator] Persisted stage data to database (docId: ${documentId})`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to persist stage data for ${documentId}:`, error);
      // Don't throw - this is debug data, shouldn't break the pipeline
    }
  }

  async processDocument(
    documentId: string,
    options: {
      forceReprocess?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<ExtractionResult> {
    const stages: ExtractionStage[] = [];
    
    // CRITICAL: Reset extraction stages data to prevent cross-run leakage
    this.extractionStagesData = {};
    
    console.log(`[Orchestrator] Starting extraction pipeline for document ${documentId}`);
    console.log(`[Orchestrator] Options:`, options);

    try {
      // Get document metadata
      const document = await this.storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Handle deduplication: delete old snapshots if forceReprocess is enabled
      if (options.forceReprocess) {
        const existingSnapshots = await this.storage.getOfferSnapshotsByDocument(documentId);
        if (existingSnapshots.length > 0) {
          console.log(`[Orchestrator] Force reprocess: superseding ${existingSnapshots.length} existing snapshots`);
        }
        // Step 3.1: Reset status to pending for forceReprocess
        await this.markDocumentStatus(documentId, "pending", null, { totalPoliciesExtracted: null });
      } else {
        // Check if already processed
        const existingSnapshots = await this.storage.getOfferSnapshotsByDocument(documentId);
        if (existingSnapshots.length > 0) {
          console.log(`[Orchestrator] Document already processed (${existingSnapshots.length} snapshots), skipping. Use forceReprocess to regenerate.`);
          return {
            success: true,
            documentId,
            snapshots: existingSnapshots,
            stages: [{
              name: "deduplication_check",
              status: "completed",
              startedAt: new Date(),
              completedAt: new Date(),
              output: { skipped: true, reason: "Already processed", existingCount: existingSnapshots.length }
            }]
          };
        }
      }

      // Step 3.1: Mark document as 'processing' before OCR work begins
      await this.markDocumentStatus(documentId, "processing");

      // Stage 1: OCR Extraction
      const ocrStage = this.createStage("ocr_extraction");
      stages.push(ocrStage);
      const ocrOutput = await this.runOcrStage(document, ocrStage);

      // Stage 1.5: Document Classification (Step 1.3)
      // Classify if this is an insurance policy or unknown document type
      const classificationStage = this.createStage("document_classification");
      stages.push(classificationStage);
      const classificationResult = await this.runClassificationStage(
        ocrOutput,
        document,
        classificationStage
      );
      
      // If document is NOT an insurance policy, stop pipeline early
      if (classificationResult.kind === 'unknown') {
        console.log(`[Orchestrator] Document ${documentId} classified as UNKNOWN - stopping pipeline`);
        console.log(`[Orchestrator] Reason: ${classificationResult.reason}`);
        
        // Step 3.1: Mark as completed (not failed) - it's valid to have non-insurance documents
        await this.markDocumentStatus(documentId, "completed", null, {
          documentKind: 'unknown',
          documentKindConfidence: classificationResult.confidence,
          totalPoliciesExtracted: 0,
        });
        
        return {
          success: true,
          documentId,
          snapshots: [],
          stages,
          error: `Document classified as unknown: ${classificationResult.reason}`
        };
      }
      
      // Update document as insurance_policy
      await this.storage.updateDocument(documentId, {
        documentKind: 'insurance_policy',
        documentKindConfidence: classificationResult.confidence,
      });

      // Stage 2: Validation & Preprocessing
      const validationStage = this.createStage("validation");
      stages.push(validationStage);
      const validationResult = await this.runValidationStage(
        ocrOutput, 
        validationStage,
        options.skipValidation
      );

      // Stage 3: Structured Extraction
      let extractedPolicies: StructuredPolicy[];
      
      if (this.useTwoStepPipeline) {
        // NEW 2-STEP PIPELINE: Segmentation → Extraction
        console.log(`[Orchestrator] Using NEW two-step extraction pipeline`);
        
        // Stage 3a: Policy Segmentation
        const segmentationStage = this.createStage("policy_segmentation");
        stages.push(segmentationStage);
        const segments = await this.runSegmentationStage(
          ocrOutput,
          documentId,
          segmentationStage
        );
        
        // NEW: Create PolicySnapshots immediately after segmentation
        // This creates canonical snapshot records for both current and offer policies
        await this.createPolicySnapshotsFromSegments(document, this.extractionStagesData);
        
        // Stage 3b: Segment-based Extraction
        const extractionStage = this.createStage("segment_extraction");
        stages.push(extractionStage);
        extractedPolicies = await this.runSegmentExtractionStage(
          segments,
          documentId,
          extractionStage
        );
      } else {
        // LEGACY PIPELINE: Direct extraction from full OCR
        console.log(`[Orchestrator] Using LEGACY single-step extraction pipeline`);
        const extractionStage = this.createStage("structured_extraction");
        stages.push(extractionStage);
        extractedPolicies = await this.runExtractionStage(
          ocrOutput,
          validationResult,
          extractionStage
        );
      }

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

      // Stage 5: Phase 1 PolicyExtractor (ALWAYS run to populate structured_policy for deterministic matching)
      // This ensures offer_snapshots.structured_policy has address/offerNumber/person data
      // needed by Phase 3 (deterministic matcher) to find policy pairs
      const policyExtractorStage = this.createStage("phase1_policy_extractor");
      stages.push(policyExtractorStage);
      await this.runPolicyExtractorStage(
        snapshots,
        ocrOutput,
        policyExtractorStage
      );

      // Step 3.1: Mark document as completed with policy count
      await this.markDocumentStatus(documentId, "completed", null, {
        totalPoliciesExtracted: snapshots.length
      });

      return {
        success: true,
        documentId,
        snapshots,
        stages
      };

    } catch (error) {
      console.error(`[Orchestrator] Pipeline failed for document ${documentId}:`, error);
      
      // Step 3.1: Mark document as failed with error reason
      const errorReason = mapErrorToReason(error);
      await this.markDocumentStatus(documentId, "failed", errorReason);
      
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
      console.log(`[Orchestrator] Stage 1: OCR extraction...`);
      
      // Try to use stored OCR data first (avoid re-processing PDFs)
      const ocrRawResponse = document.ocrRawResponse as any;
      let markdown: string;
      let pageCount: number;
      let source: string;
      
      if (ocrRawResponse?.pages && Array.isArray(ocrRawResponse.pages)) {
        markdown = ocrRawResponse.pages
          .map((page: any) => page.markdown)
          .join('\n\n---\n\n');
        pageCount = ocrRawResponse.pages.length;
        source = 'cached';
        
        console.log(`[Orchestrator] Using cached OCR data: ${markdown.length} chars, ${pageCount} pages`);
      } else {
        // Fallback: Extract from PDF if no cached data
        console.log(`[Orchestrator] No cached OCR data, extracting from PDF...`);
        const { MistralOCRService } = await import("./mistralOcrService");
        const ocrService = new MistralOCRService();
        
        markdown = await ocrService.extractTextFromPDF(document.filePath);
        pageCount = 0;
        source = 'fresh_extraction';
        
        console.log(`[Orchestrator] OCR completed: ${markdown.length} chars extracted`);
      }
      
      stage.status = "completed";
      stage.completedAt = new Date();
      const latencyMs = stage.completedAt.getTime() - stage.startedAt!.getTime();
      
      stage.output = { 
        markdownLength: markdown.length,
        source,
        pageCount
      };
      
      // PERSIST STAGE 1 DATA
      this.extractionStagesData.stage1_ocr = {
        rawOutput: markdown,
        timestamp: stage.completedAt.toISOString(),
        metadata: {
          source,
          markdownLength: markdown.length,
          pageCount,
          latencyMs
        }
      };
      
      await this.persistStageData(document.id);
      console.log(`[Orchestrator] Stage 1 data persisted (${markdown.length} chars)`);
      
      return {
        markdown,
        pageCount
      };
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Step 1.3: Classify if document is an insurance policy or unknown document type
   * Uses keyword heuristics to make this determination
   */
  private async runClassificationStage(
    ocrOutput: OcrOutput,
    document: any,
    stage: ExtractionStage
  ): Promise<DocumentClassificationResult> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 1.5: Document classification...`);
      
      const result = classifyDocumentKind(ocrOutput.markdown);
      
      console.log(`[Orchestrator] Classification: ${result.kind} (confidence: ${result.confidence}%)`);
      console.log(`[Orchestrator] Matched keywords: ${result.matchedKeywords.slice(0, 5).join(', ')}${result.matchedKeywords.length > 5 ? '...' : ''}`);
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = {
        kind: result.kind,
        confidence: result.confidence,
        matchedKeywordsCount: result.matchedKeywords.length,
        reason: result.reason
      };
      
      return result;
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      
      // Default to insurance_policy on error (fail-safe)
      console.warn(`[Orchestrator] Classification failed, defaulting to insurance_policy:`, error);
      return {
        kind: 'insurance_policy',
        confidence: 50,
        matchedKeywords: [],
        reason: 'Classification failed - defaulting to insurance policy'
      };
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

      const errors: string[] = [];
      const warnings: string[] = [];
      const markdown = ocrOutput.markdown.toLowerCase();
      
      // QUALITY GATE 1: Minimum content length
      if (ocrOutput.markdown.length < 200) {
        errors.push("OCR output too short - likely incomplete extraction");
      }
      
      // QUALITY GATE 2: Insurance document indicators
      const insuranceKeywords = ['forsikring', 'police', 'præmie', 'dækning', 'selvrisiko'];
      const hasInsuranceKeywords = insuranceKeywords.some(keyword => markdown.includes(keyword));
      if (!hasInsuranceKeywords) {
        errors.push("No insurance keywords found - may not be an insurance document");
      }
      
      // QUALITY GATE 3: Pricing information presence
      const hasPricing = markdown.includes('kr') || markdown.includes('dkk') || /\d+[.,]\d+/.test(markdown);
      if (!hasPricing) {
        warnings.push("No pricing information detected");
      }
      
      // QUALITY GATE 4: Company indicators
      const hasCompany = markdown.includes('forsikring') || markdown.includes('selskab');
      if (!hasCompany) {
        warnings.push("No insurance company indicators found");
      }
      
      // QUALITY GATE 5: Coverage/policy type indicators
      const policyTypes = ['hus', 'indbo', 'ulykke', 'bil', 'rejse', 'liv', 'sundhed', 'fritidshus'];
      const hasPolicyType = policyTypes.some(type => markdown.includes(type));
      if (!hasPolicyType) {
        warnings.push("No clear policy type indicators found");
      }

      // Calculate confidence based on quality gates passed
      let confidence = 1.0;
      if (errors.length > 0) confidence = 0.3; // Critical failures
      else if (warnings.length >= 3) confidence = 0.6; // Many warnings
      else if (warnings.length > 0) confidence = 0.8; // Some warnings
      
      // FAIL PIPELINE if critical errors detected
      const isValid = errors.length === 0;
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { 
        errors, 
        warnings, 
        confidence,
        qualityGatesPassed: 5 - errors.length - warnings.length
      };
      
      console.log(`[Orchestrator] Validation: ${isValid ? 'PASSED' : 'FAILED'}`);
      console.log(`[Orchestrator] Quality gates: ${5 - errors.length - warnings.length}/5 passed`);
      console.log(`[Orchestrator] Errors: ${errors.length}, Warnings: ${warnings.length}, Confidence: ${confidence}`);
      
      if (!isValid) {
        console.error(`[Orchestrator] VALIDATION FAILED - blocking pipeline:`, errors);
      }
      
      return {
        isValid,
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
      
      // Use OpenAI extraction service
      const { OpenAIExtractionService } = await import("./openaiExtractionService");
      const extractionService = new OpenAIExtractionService(this.storage);
      
      // Extract policies from OCR markdown
      const result = await extractionService.extractPoliciesFromMarkdown(
        ocrOutput.markdown,
        "" // documentId not needed for extraction
      );
      
      if (!result.success) {
        throw new Error(`OpenAI extraction failed: ${result.error}`);
      }
      
      // Convert to StructuredPolicy format
      const policies: StructuredPolicy[] = result.policies.map(p => ({
        policyType: p.policyType,
        companyName: p.companyName,
        premium: p.premium,
        deductible: p.deductible,
        coverageDetails: p.coverageDetails,
        sourcePageRange: p.sourcePageRange,
        confidence: p.confidence,
      }));
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { 
        policiesExtracted: policies.length,
        processingTimeMs: result.processingTimeMs,
        model: result.model
      };
      
      console.log(`[Orchestrator] Extraction completed: ${policies.length} policies in ${result.processingTimeMs}ms`);
      
      return policies;
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async runSegmentationStage(
    ocrOutput: OcrOutput,
    documentId: string,
    stage: ExtractionStage
  ): Promise<any[]> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      console.log(`[Orchestrator] Stage 3a: Running policy segmentation...`);
      
      // Validate OCR output before segmentation
      if (!ocrOutput.markdown || ocrOutput.markdown.length < 100) {
        throw new Error('OCR output too short for meaningful segmentation');
      }
      
      const { segmentPoliciesWithFallback } = await import("./policySegmentationService");
      
      const result = await segmentPoliciesWithFallback(
        ocrOutput.markdown,
        documentId
      );
      
      // CRITICAL: Validate we have at least one segment
      if (!result.segments || result.segments.length === 0) {
        throw new Error(
          `Segmentation failed to identify any policies. ` +
          `This may indicate: (1) document is not an insurance policy, ` +
          `(2) OCR quality too low, or (3) AI model failure. ` +
          `Processing notes: ${result.summary.processingNotes || 'none'}`
        );
      }
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { 
        segmentsFound: result.summary.totalPolicies,
        policyTypes: result.summary.policyTypes,
        overallConfidence: result.summary.overallConfidence,
        modelUsed: result.metadata.modelUsed,
        tokensUsed: result.metadata.tokensUsed,
        costUsd: result.metadata.costUsd,
        latencyMs: result.metadata.latencyMs
      };
      
      console.log(
        `[Orchestrator] Segmentation completed: ${result.summary.totalPolicies} policies found | ` +
        `Types: [${result.summary.policyTypes.join(', ')}] | ` +
        `Confidence: ${(result.summary.overallConfidence * 100).toFixed(1)}% | ` +
        `Cost: $${result.metadata.costUsd.toFixed(4)} | ${result.metadata.latencyMs}ms`
      );
      
      // PERSIST STAGE 2 DATA
      this.extractionStagesData.stage2_segmentation = {
        rawOutput: result.segments,
        timestamp: stage.completedAt.toISOString(),
        metadata: {
          segmentCount: result.summary.totalPolicies,
          modelUsed: result.metadata.modelUsed,
          tokensUsed: result.metadata.tokensUsed,
          costUsd: result.metadata.costUsd,
          latencyMs: result.metadata.latencyMs,
          confidenceScores: result.segments.map(s => s.metadata.confidence)
        }
      };
      
      await this.persistStageData(documentId);
      console.log(`[Orchestrator] Stage 2 data persisted (${result.summary.totalPolicies} segments)`);
      
      return result.segments;
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] Segmentation failed:`, error);
      throw error;
    }
  }

  private async runSegmentExtractionStage(
    segments: any[],
    documentId: string,
    stage: ExtractionStage
  ): Promise<StructuredPolicy[]> {
    stage.status = "running";
    stage.startedAt = new Date();
    
    try {
      // CRITICAL: Validate segments exist before processing
      if (!segments || segments.length === 0) {
        stage.status = "failed";
        stage.completedAt = new Date();
        stage.error = 'No segments provided to extraction stage';
        stage.output = { 
          segmentsProcessed: 0,
          policiesExtracted: 0,
          successCount: 0,
          failureCount: 0
        };
        throw new Error('Cannot run extraction: no segments provided (segmentation may have failed)');
      }
      
      console.log(`[Orchestrator] Stage 3b: Running segment-based extraction...`);
      console.log(`[Orchestrator] Processing ${segments.length} segments...`);
      
      const { OpenAIExtractionService } = await import("./openaiExtractionService");
      const extractionService = new OpenAIExtractionService(this.storage);
      
      const policies: StructuredPolicy[] = [];
      const extractionMetrics = {
        totalCost: 0,
        totalLatency: 0,
        successCount: 0,
        failureCount: 0,
        errors: [] as string[]
      };
      
      for (const segment of segments) {
        try {
          const extracted = await extractionService.extractPolicyFromSegment(
            segment,
            documentId
          );
          
          policies.push(extracted);
          extractionMetrics.successCount++;
          
        } catch (error: any) {
          const errorMsg = `${segment.policyType}: ${error.message}`;
          console.error(`[Orchestrator] Failed to extract ${segment.policyType}:`, error.message);
          extractionMetrics.failureCount++;
          extractionMetrics.errors.push(errorMsg);
        }
      }
      
      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = { 
        segmentsProcessed: segments.length,
        policiesExtracted: policies.length,
        successCount: extractionMetrics.successCount,
        failureCount: extractionMetrics.failureCount,
        errors: extractionMetrics.errors
      };
      
      console.log(
        `[Orchestrator] Segment extraction completed: ${policies.length}/${segments.length} policies extracted | ` +
        `Success: ${extractionMetrics.successCount}, Failures: ${extractionMetrics.failureCount}`
      );
      
      // PERSIST STAGE 3 DATA (even on partial failures)
      const latencyMs = stage.completedAt.getTime() - stage.startedAt!.getTime();
      this.extractionStagesData.stage3_extraction = {
        rawOutput: policies, // Successfully extracted policies
        timestamp: stage.completedAt.toISOString(),
        metadata: {
          policyCount: policies.length,
          latencyMs,
          successCount: extractionMetrics.successCount,
          failureCount: extractionMetrics.failureCount,
          errors: extractionMetrics.errors.length > 0 ? extractionMetrics.errors : undefined
        }
      };
      
      await this.persistStageData(documentId);
      console.log(`[Orchestrator] Stage 3 data persisted (${policies.length} policies, ${extractionMetrics.failureCount} failures)`);
      
      // CRITICAL: Fail if ALL extractions failed
      if (policies.length === 0) {
        throw new Error(
          `All ${segments.length} segment extractions failed. Errors: ${extractionMetrics.errors.join('; ')}`
        );
      }
      
      // WARN: Partial success (some policies extracted)
      if (extractionMetrics.failureCount > 0) {
        console.warn(
          `[Orchestrator] Partial extraction success: ${extractionMetrics.failureCount}/${segments.length} segments failed. ` +
          `Continuing with ${policies.length} successfully extracted policies.`
        );
      }
      
      return policies;
    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] Segment extraction stage failed:`, error);
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
        // Prioritize relational company_id from document (set via emailThread)
        // Fallback to OCR-extracted company name only if document.companyId is null
        let companyId = document.companyId;
        let companyIdSource = 'relational';
        
        if (!companyId) {
          companyId = await this.resolveCompanyName(policy.companyName);
          companyIdSource = 'ocr_extraction';
          console.log(`[Orchestrator] No relational company_id for document ${document.id}, resolved from OCR: ${policy.companyName} → ${companyId}`);
        } else {
          console.log(`[Orchestrator] Using relational company_id from document: ${companyId}`);
        }
        
        const insertData: InsertOfferSnapshot = {
          documentId: document.id,
          userId: document.userId,
          policyId: null, // Will be linked later during matching
          policyType: policy.policyType,
          companyId: companyId,
          premium: policy.premium !== null ? policy.premium.toString() : null,
          deductible: policy.deductible !== null ? policy.deductible.toString() : null,
          coverageDetails: policy.coverageDetails,
          extractionVersion: this.version,
          extractorModel: "gpt-4o-mini",
          extractorProvider: "openai",
          confidenceScore: Math.round(policy.confidence * 100), // Convert 0.0-1.0 to 0-100
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

  /**
   * Phase 1: PolicyExtractor Stage (Two-Phase Health Check Architecture)
   * 
   * Runs after offer_snapshots are created. Extracts structured policy JSON
   * from OCR markdown and stores it in offer_snapshots.structuredPolicy.
   * 
   * Phase 1b: PricingAgent extracts and normalizes pricing for each policy.
   * 
   * This enables Phase 2 (HealthCheckAnalyst) to use deterministic 1:1 coverage mapping.
   */
  private async runPolicyExtractorStage(
    snapshots: OfferSnapshot[],
    ocrOutput: OcrOutput,
    stage: ExtractionStage
  ): Promise<void> {
    stage.status = "running";
    stage.startedAt = new Date();

    try {
      console.log(`[Orchestrator] Stage 5 (Phase 1): Running PolicyExtractor for ${snapshots.length} snapshots...`);

      const { policyExtractorService } = await import("./policyExtractorService");
      const { policyPricingService } = await import("./policyPricingService");
      const { coverageValidator } = await import("../utils/coverageValidator");

      // Run Phase 1 extraction on OCR markdown
      const extractionResult = await policyExtractorService.extractPolicies(ocrOutput.markdown);

      // Validate extraction quality
      const validation = coverageValidator.validateExtractionResult(extractionResult.policies);
      
      if (!validation.isValid) {
        console.warn(`[Orchestrator] Phase 1 validation failed:`, validation.errors);
        throw new Error(`Phase 1 validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn(`[Orchestrator] Phase 1 warnings:`, validation.warnings);
      }

      // Phase 1b: Run PricingAgent for each policy and attach pricing
      // CRITICAL FIX (Dec 2025): Use SEGMENT-ONLY text to prevent price cross-contamination
      console.log(`[Orchestrator] Phase 1b: Running PricingAgent for ${extractionResult.policies.length} policies...`);
      
      // Get segmentation data for segment-isolated pricing extraction
      const segmentationData = this.extractionStagesData.stage2_segmentation?.rawOutput || [];
      console.log(`[Orchestrator] Found ${segmentationData.length} segments for segment-isolated pricing`);
      
      const pricingResults: any[] = [];
      let pricingSuccessCount = 0;
      let pricingFailureCount = 0;
      const pricingFailures: { policyType: string; reason: string }[] = [];
      
      for (const structuredPolicy of extractionResult.policies) {
        try {
          // CRITICAL: Find the matching segment for this policy type
          // This ensures PricingAgent only sees text for THIS policy, not the entire document
          const policyType = structuredPolicy.policyType.toLowerCase();
          
          // Extended policy type equivalences for matching
          const policyTypeEquivalences: Record<string, string[]> = {
            'hus': ['hus', 'fritidshus', 'villa', 'sommerhus', 'husforsikring'],
            'fritidshus': ['fritidshus', 'hus', 'sommerhus', 'fritidshusforsikring'],
            'indbo': ['indbo', 'indboforsikring'],
            'ulykke': ['ulykke', 'ulykkesforsikring', 'personulykke'],
            'bil': ['bil', 'bilforsikring', 'auto', 'autoforsikring'],
            'rejse': ['rejse', 'rejseforsikring'],
            'ansvar': ['ansvar', 'ansvarsforsikring'],
            'husdyr': ['husdyr', 'dyreforsikring', 'hund', 'kat'],
          };
          
          const matchingSegment = segmentationData.find((seg: any) => {
            const segType = (seg.policyType || '').toLowerCase();
            // Direct match
            if (segType === policyType) return true;
            // Check equivalences
            const equivalents = policyTypeEquivalences[policyType] || [];
            if (equivalents.includes(segType)) return true;
            const reverseEquivalents = policyTypeEquivalences[segType] || [];
            if (reverseEquivalents.includes(policyType)) return true;
            return false;
          });
          
          // MULTI-PASS PRICING PIPELINE (Dec 2025)
          // Pass 1: Try segment-only regex
          // Pass 2: Search nearby OCR for policy-specific prices
          // Pass 3: LLM fallback with full context
          
          const segmentText = matchingSegment?.rawContent || '';
          const hasSegment = segmentText.length >= 100;
          
          if (hasSegment) {
            console.log(`[Orchestrator] Using segment-isolated text for ${policyType} pricing (${segmentText.length} chars)`);
          } else {
            console.log(`[Orchestrator] ⚠️ No segment for ${policyType} - using multi-pass fallback with full OCR`);
          }
          
          // CRITICAL: Always provide fullOcrText for multi-pass fallback
          const fullOcrText = ocrOutput.markdown;
          
          const pricing = await policyPricingService.extractPricingForPolicy({
            policyType: structuredPolicy.policyType,
            companyName: structuredPolicy.company || null,
            currency: "DKK",
            rawText: segmentText || `[No segment - using full OCR fallback for ${policyType}]`,
            fullOcrText: fullOcrText // NEW: Enable multi-pass fallback
          });

          // Attach pricing to structuredPolicy
          structuredPolicy.pricing = pricing;
          
          // Mirror annualPremium at top level for backward compatibility
          structuredPolicy.annualPremium = pricing.annualPremium ?? null;

          pricingResults.push({
            policyType: structuredPolicy.policyType,
            status: pricing.pricingStatus,
            annualPremium: pricing.annualPremium,
            confidence: pricing.pricingConfidence
          });

          // Telemetry: Track success/failure
          if (pricing.pricingStatus === 'ok') {
            pricingSuccessCount++;
            console.log(`[Orchestrator] ✅ PricingAgent SUCCESS for ${structuredPolicy.policyType}: premium=${pricing.annualPremium} DKK, confidence=${pricing.pricingConfidence}%`);
          } else {
            pricingFailureCount++;
            const reason = `status=${pricing.pricingStatus}, notes=${pricing.notes}`;
            pricingFailures.push({ policyType: structuredPolicy.policyType, reason });
            console.warn(`[Orchestrator] ⚠️ PricingAgent DEGRADED for ${structuredPolicy.policyType}: ${reason}`);
          }
        } catch (error) {
          pricingFailureCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          pricingFailures.push({ policyType: structuredPolicy.policyType, reason: `Exception: ${errorMsg}` });
          console.error(`[Orchestrator] ❌ PricingAgent EXCEPTION for ${structuredPolicy.policyType}:`, error);
          // Continue - pricing is optional, don't block entire extraction
        }
      }

      // Emit comprehensive telemetry summary
      const successRate = extractionResult.policies.length > 0 
        ? ((pricingSuccessCount / extractionResult.policies.length) * 100).toFixed(1)
        : '0.0';

      console.log(`[Orchestrator] Phase 1b completed: ${pricingResults.length}/${extractionResult.policies.length} policies processed`);
      console.log(`[Orchestrator] PricingAgent Telemetry: ${pricingSuccessCount} OK, ${pricingFailureCount} degraded/failed (${successRate}% success rate)`);
      
      if (pricingFailures.length > 0) {
        console.warn(`[Orchestrator] PricingAgent Failures:`, JSON.stringify(pricingFailures, null, 2));
      }

      // Match extracted policies (with pricing) to snapshots by policy type
      // Assumption: policies are in same order as snapshots (both created from same extraction)
      for (let i = 0; i < Math.min(snapshots.length, extractionResult.policies.length); i++) {
        const snapshot = snapshots[i];
        const structuredPolicy = extractionResult.policies[i];

        console.log(`[Orchestrator] Updating offer_snapshot ${snapshot.id} with structured policy (${structuredPolicy.policyType})`);

        // Update offer_snapshot with structured policy (includes pricing) - LEGACY
        await this.storage.updateOfferSnapshot(snapshot.id, {
          structuredPolicy: structuredPolicy as any
        });
      }

      // ========================================================================
      // NEW: Also update policy_snapshots table (the NEW canonical source of truth)
      // This ensures health check page can show pricing from policy_snapshots
      // ========================================================================
      try {
        const { policySnapshotService } = await import("./policySnapshots/PolicySnapshotService");
        
        // Get the document ID from any snapshot (they all have the same documentId)
        const documentId = snapshots.length > 0 ? snapshots[0].documentId : null;
        
        if (documentId) {
          // Fetch active policy_snapshots for this document
          const policySnapshots = await policySnapshotService.getActiveSnapshotsByDocument(documentId);
          
          console.log(`[Orchestrator] Updating ${policySnapshots.length} policy_snapshots with pricing data...`);
          
          // Policy type equivalences for matching (extracted type → snapshot types that match)
          const policyTypeEquivalences: Record<string, string[]> = {
            'hus': ['hus', 'fritidshus', 'villa', 'sommerhus'],
            'fritidshus': ['fritidshus', 'hus', 'sommerhus'],
            'indbo': ['indbo', 'indboforsikring'],
            'ulykke': ['ulykke', 'ulykkesforsikring'],
            'bil': ['bil', 'bilforsikring', 'auto'],
            'rejse': ['rejse', 'rejseforsikring'],
            'ansvar': ['ansvar', 'ansvarsforsikring'],
            'husdyr': ['husdyr', 'dyreforsikring', 'hund', 'kat'],
          };
          
          // Match by policyType (with equivalences) and update each policy_snapshot
          for (const policySnapshot of policySnapshots) {
            const snapshotType = policySnapshot.policyType.toLowerCase();
            
            // Find matching extracted policy using equivalences
            const matchingPolicy = extractionResult.policies.find(p => {
              const extractedType = p.policyType.toLowerCase();
              
              // Direct match
              if (extractedType === snapshotType) return true;
              
              // Check if extracted type has equivalences that include snapshot type
              const equivalents = policyTypeEquivalences[extractedType] || [];
              if (equivalents.includes(snapshotType)) return true;
              
              // Reverse check: snapshot type has equivalences that include extracted type
              const reverseEquivalents = policyTypeEquivalences[snapshotType] || [];
              if (reverseEquivalents.includes(extractedType)) return true;
              
              return false;
            });
            
            if (matchingPolicy) {
              console.log(`[Orchestrator] Updating policy_snapshot ${policySnapshot.id} with structured policy (${matchingPolicy.policyType} → ${snapshotType})`);
              
              await policySnapshotService.updateSnapshotEnrichment(policySnapshot.id, {
                structuredPolicy: matchingPolicy as any
              });
            } else {
              console.warn(`[Orchestrator] No matching extracted policy for policy_snapshot ${policySnapshot.id} (${policySnapshot.policyType})`);
            }
          }
          
          console.log(`[Orchestrator] ✓ policy_snapshots updated with pricing data`);
        }
      } catch (error) {
        console.error(`[Orchestrator] Failed to update policy_snapshots:`, error);
        // Don't throw - this shouldn't break the pipeline
      }

      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = {
        policiesExtracted: extractionResult.policies.length,
        snapshotsUpdated: Math.min(snapshots.length, extractionResult.policies.length),
        validationWarnings: validation.warnings,
        pricingResults // Include pricing stats in stage output
      };

      console.log(`[Orchestrator] Phase 1 completed: ${extractionResult.policies.length} policies extracted, ${validation.warnings.length} warnings`);

    } catch (error) {
      stage.status = "failed";
      stage.completedAt = new Date();
      stage.error = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] Phase 1 PolicyExtractor failed:`, error);
      // Don't throw - allow pipeline to complete without Phase 1 (falls back to legacy)
    }
  }

  /**
   * NEW REFACTORED ARCHITECTURE (Dec 2025):
   * Create PolicySnapshots from segmentation data.
   * 
   * This creates the CANONICAL representation of all policies (current + offers).
   * PolicySnapshots replace the old OfferSnapshots → HealthCheck → Comparison flow
   * with a simpler, more robust architecture.
   */
  private async createPolicySnapshotsFromSegments(
    document: any,
    extractionStages: ExtractionStagesData
  ): Promise<void> {
    try {
      console.log(`[Orchestrator] Creating PolicySnapshots from segmentation data...`);
      
      const { policySnapshotService } = await import("./policySnapshots/PolicySnapshotService");
      
      const snapshots = await policySnapshotService.createSnapshotsFromDocument(
        document,
        extractionStages
      );
      
      console.log(
        `[Orchestrator] ✓ Created ${snapshots.length} PolicySnapshots ` +
        `(kind=${document.documentType}, doc=${document.id})`
      );
    } catch (error) {
      console.error(`[Orchestrator] Failed to create PolicySnapshots:`, error);
      // Don't throw - this is a new feature, shouldn't break existing pipeline
    }
  }

  private async resolveCompanyName(companyName: string): Promise<string | null> {
    try {
      // Get all companies
      const companies = await this.storage.getActiveCompanies();
      
      if (companies.length === 0) {
        console.log(`[Orchestrator] No companies in database, cannot resolve "${companyName}"`);
        return null;
      }

      const normalized = companyName.toLowerCase().trim();
      
      // Try exact match first
      for (const company of companies) {
        if (company.name.toLowerCase().trim() === normalized) {
          console.log(`[Orchestrator] Exact match: "${companyName}" → ${company.id}`);
          return company.id;
        }
      }

      // Try fuzzy match (contains)
      for (const company of companies) {
        const companyLower = company.name.toLowerCase();
        if (companyLower.includes(normalized) || normalized.includes(companyLower)) {
          console.log(`[Orchestrator] Fuzzy match: "${companyName}" → ${company.name} (${company.id})`);
          return company.id;
        }
      }

      console.log(`[Orchestrator] No match found for company "${companyName}"`);
      return null;
      
    } catch (error) {
      console.error(`[Orchestrator] Error resolving company name:`, error);
      return null;
    }
  }
}
