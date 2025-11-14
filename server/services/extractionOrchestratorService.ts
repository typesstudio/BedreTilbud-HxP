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

export class ExtractionOrchestratorService {
  private storage: IStorage;
  private version = "2.1.0"; // Updated for two-step pipeline
  private useTwoStepPipeline: boolean;
  private useTwoPhaseHealthCheck: boolean;
  private extractionStagesData: ExtractionStagesData = {}; // Accumulate stage data

  constructor(storage: IStorage) {
    this.storage = storage;
    // Default to NEW two-step pipeline (better quality). Set ENABLE_TWO_STEP_EXTRACTION=false to use legacy.
    this.useTwoStepPipeline = process.env.ENABLE_TWO_STEP_EXTRACTION !== 'false';
    // Enable two-phase health check architecture (Phase 1: PolicyExtractor, Phase 2: HealthCheckAnalyst)
    this.useTwoPhaseHealthCheck = process.env.ENABLE_TWO_PHASE_HEALTHCHECK === 'true';
    console.log(`[Orchestrator] Two-step pipeline: ${this.useTwoStepPipeline ? 'ENABLED (v2.1.0)' : 'DISABLED (legacy v2.0.0)'}`);
    console.log(`[Orchestrator] Two-phase health check: ${this.useTwoPhaseHealthCheck ? 'ENABLED' : 'DISABLED'}`);
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
          console.log(`[Orchestrator] Force reprocess: deleting ${existingSnapshots.length} existing snapshots`);
          // Note: We don't have a bulk delete method, but we can document this for future optimization
          // For now, log that we're superseding old data
          console.log(`[Orchestrator] Old snapshots will be superseded by new extraction (version ${this.version})`);
        }
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

      // Stage 5 (Optional): Phase 1 PolicyExtractor for Two-Phase Health Check
      if (this.useTwoPhaseHealthCheck) {
        const policyExtractorStage = this.createStage("phase1_policy_extractor");
        stages.push(policyExtractorStage);
        await this.runPolicyExtractorStage(
          snapshots,
          ocrOutput,
          policyExtractorStage
        );
      }

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
        // Resolve company name to ID
        const companyId = await this.resolveCompanyName(policy.companyName);
        
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

      // Match extracted policies to snapshots by policy type
      // Assumption: policies are in same order as snapshots (both created from same extraction)
      for (let i = 0; i < Math.min(snapshots.length, extractionResult.policies.length); i++) {
        const snapshot = snapshots[i];
        const structuredPolicy = extractionResult.policies[i];

        console.log(`[Orchestrator] Updating snapshot ${snapshot.id} with structured policy (${structuredPolicy.policyType})`);

        // Update snapshot with structured policy
        await this.storage.updateOfferSnapshot(snapshot.id, {
          structuredPolicy: structuredPolicy as any
        });
      }

      stage.status = "completed";
      stage.completedAt = new Date();
      stage.output = {
        policiesExtracted: extractionResult.policies.length,
        snapshotsUpdated: Math.min(snapshots.length, extractionResult.policies.length),
        validationWarnings: validation.warnings
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
