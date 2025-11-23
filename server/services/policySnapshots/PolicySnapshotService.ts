/**
 * PolicySnapshotService
 * 
 * ARCHITECTURE (Dec 2025 Refactor):
 * ═══════════════════════════════════════════════════════════════════
 * PolicySnapshots are the CANONICAL representation of insurance policies.
 * 
 * This replaces the old OfferSnapshots → HealthCheck → Comparison architecture
 * with a simpler, more robust model:
 * 
 * 1. RAW OCR TEXT → stage2_segmentation → PolicySnapshots (one per policy)
 * 2. Optional enrichment: structuredPolicy + pricing added asynchronously
 * 3. Comparison + HealthCheck are VIEWS on top of PolicySnapshots
 * 
 * KEY BENEFITS:
 * - Works even when structured data / pricing is incomplete
 * - Same data model for "current" and "offer" policies
 * - Simpler matching logic (just policyType + address)
 * - Reprocessable: raw text is always preserved
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from "../../db";
import { policySnapshots, companies } from "../../../shared/schema";
import type { Document, InsertPolicySnapshot, PolicySnapshot } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

interface SegmentedPolicy {
  policyType: string; // "Fritidshus", "Indbo", "Ulykke", etc.
  rawContent: string; // The markdown text for this policy segment
  metadata: {
    pageSpan?: string;
    confidence?: number;
    extractedFields?: {
      annualPrice?: number | null;
      monthlyPrice?: number | null;
      policyNumber?: string;
      coverageAddress?: string;
      insuranceCompany?: string;
    };
    notableSections?: string[];
  };
  policySubtype?: string | null;
}

interface ExtractionStages {
  stage2_segmentation?: {
    rawOutput?: SegmentedPolicy[];
    metadata?: {
      segmentCount?: number;
      confidence?: number;
      extractedFields?: any;
    };
  };
}

export class PolicySnapshotService {
  /**
   * Create PolicySnapshots from a document's extraction stages.
   * 
   * This is called after stage2_segmentation has completed successfully.
   * For each policy segment in the document, we create a single PolicySnapshot row.
   * 
   * @param document - The document record from the database
   * @param extractionStages - The extraction_stages JSONB field
   * @returns Array of created PolicySnapshot records
   */
  async createSnapshotsFromDocument(
    document: Document,
    extractionStages: ExtractionStages
  ): Promise<PolicySnapshot[]> {
    console.log(`[PolicySnapshotService] Creating snapshots for document ${document.id} (${document.documentType})`);

    // Validate we have segmentation data
    const segmentation = extractionStages.stage2_segmentation;
    if (!segmentation || !segmentation.rawOutput || !Array.isArray(segmentation.rawOutput)) {
      console.warn(`[PolicySnapshotService] No segmentation data found for document ${document.id}`);
      return [];
    }

    const segments = segmentation.rawOutput;
    console.log(`[PolicySnapshotService] Found ${segments.length} policy segments`);

    // Determine the "kind" field based on document type
    const kind = this.determineKind(document.documentType);
    if (!kind) {
      console.error(`[PolicySnapshotService] Invalid document_type: ${document.documentType}`);
      return [];
    }

    // Create one snapshot per segment
    const snapshots: PolicySnapshot[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        // Normalize policy type (e.g., "Fritidshus" → "fritidshus")
        const policyType = this.normalizePolicyType(segment.policyType);
        
        // Extract company name from segment metadata or fall back to document company
        const companyName = await this.extractCompanyName(segment, document);
        
        // Extract coverage address (for hus/fritidshus)
        const coverageAddress = this.extractCoverageAddress(segment, policyType);
        
        // Build the snapshot record
        const snapshotData: InsertPolicySnapshot = {
          documentId: document.id,
          userId: document.userId || null,
          kind,
          companyName,
          policyType,
          coverageAddress,
          rawText: segment.rawContent,
          structuredPolicy: null, // Will be enriched later
          pricing: null, // Will be enriched later
          sourceSegmentMeta: {
            segmentIndex: i,
            pageSpan: segment.metadata.pageSpan || null,
            confidence: segment.metadata.confidence || null,
            extractedFields: segment.metadata.extractedFields || {},
            policySubtype: segment.policySubtype || null,
          },
        };

        // Insert into database
        const [snapshot] = await db.insert(policySnapshots).values(snapshotData).returning();
        snapshots.push(snapshot);

        console.log(
          `[PolicySnapshotService] ✓ Created snapshot ${snapshot.id}: ` +
          `${kind}/${policyType} from ${companyName} (segment ${i})`
        );
      } catch (error) {
        console.error(
          `[PolicySnapshotService] ✗ Failed to create snapshot for segment ${i} (${segment.policyType}):`,
          error
        );
        // Continue processing other segments
      }
    }

    console.log(`[PolicySnapshotService] Created ${snapshots.length}/${segments.length} snapshots successfully`);
    return snapshots;
  }

  /**
   * Normalize policy type from various formats to canonical lowercase
   * Examples: "Fritidshus" → "fritidshus", "Indbo" → "indbo", "Ulykke" → "ulykke"
   */
  private normalizePolicyType(rawType: string): string {
    const normalized = rawType.toLowerCase().trim();
    
    // Map common variations to canonical names
    const typeMap: Record<string, string> = {
      'fritidshus': 'fritidshus',
      'fritidshusforsikring': 'fritidshus',
      'sommerhus': 'fritidshus',
      'hus': 'hus',
      'husforsikring': 'hus',
      'villa': 'hus',
      'indbo': 'indbo',
      'indboforsikring': 'indbo',
      'ulykke': 'ulykke',
      'ulykkesforsikring': 'ulykke',
      'bil': 'bil',
      'bilforsikring': 'bil',
      'rejse': 'rejse',
      'rejseforsikring': 'rejse',
      'andet': 'andet',
      'other': 'andet',
    };

    return typeMap[normalized] || normalized;
  }

  /**
   * Determine the "kind" field (current or offer) from document type
   */
  private determineKind(documentType: string | null): "current" | "offer" | null {
    if (!documentType) return null;
    
    const lower = documentType.toLowerCase();
    if (lower === 'current') return 'current';
    if (lower === 'offer') return 'offer';
    
    return null;
  }

  /**
   * Extract company name from segment metadata or document
   */
  private async extractCompanyName(segment: SegmentedPolicy, document: Document): Promise<string> {
    // Try segment metadata first
    if (segment.metadata?.extractedFields?.insuranceCompany) {
      return segment.metadata.extractedFields.insuranceCompany;
    }

    // Fallback: try to get from document's companyId
    if (document.companyId) {
      try {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, document.companyId))
          .limit(1);
        
        if (company) {
          return company.name;
        }
      } catch (error) {
        console.warn(`[PolicySnapshotService] Failed to fetch company name for ${document.companyId}:`, error);
      }
    }

    // Last resort: return placeholder
    return 'Unknown Company';
  }

  /**
   * Extract coverage address for hus/fritidshus policies
   */
  private extractCoverageAddress(segment: SegmentedPolicy, policyType: string): string | null {
    // Only relevant for property insurance
    if (policyType !== 'hus' && policyType !== 'fritidshus') {
      return null;
    }

    // Try to get from extracted fields
    if (segment.metadata?.extractedFields?.coverageAddress) {
      return segment.metadata.extractedFields.coverageAddress;
    }

    return null;
  }

  /**
   * Get all snapshots for a user by kind
   */
  async getSnapshotsByUserAndKind(
    userId: string,
    kind: 'current' | 'offer'
  ): Promise<PolicySnapshot[]> {
    return await db
      .select()
      .from(policySnapshots)
      .where(and(eq(policySnapshots.userId, userId), eq(policySnapshots.kind, kind)));
  }

  /**
   * Get snapshots for a specific document
   */
  async getSnapshotsByDocument(documentId: string): Promise<PolicySnapshot[]> {
    return await db
      .select()
      .from(policySnapshots)
      .where(eq(policySnapshots.documentId, documentId));
  }

  /**
   * Get a single snapshot by ID
   */
  async getSnapshotById(snapshotId: string): Promise<PolicySnapshot | null> {
    const results = await db
      .select()
      .from(policySnapshots)
      .where(eq(policySnapshots.id, snapshotId))
      .limit(1);
    
    return results[0] || null;
  }

  /**
   * Update a snapshot's enrichment data (structuredPolicy and/or pricing)
   */
  async updateSnapshotEnrichment(
    snapshotId: string,
    data: {
      structuredPolicy?: any;
      pricing?: any;
    }
  ): Promise<void> {
    await db
      .update(policySnapshots)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(policySnapshots.id, snapshotId));

    console.log(`[PolicySnapshotService] Updated enrichment for snapshot ${snapshotId}`);
  }
}

export const policySnapshotService = new PolicySnapshotService();
