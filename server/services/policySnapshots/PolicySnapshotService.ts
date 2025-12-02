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
import { policySnapshots, companies, companyComparisons } from "../../../shared/schema";
import type { Document, InsertPolicySnapshot, PolicySnapshot } from "../../../shared/schema";
import { eq, and, ne, sql } from "drizzle-orm";

/**
 * Step 3.3: Supported policy types for matching and health checks.
 * Policies with types NOT in this list are marked as "unknown_type" and skipped.
 */
export const SUPPORTED_POLICY_TYPES = [
  'indbo',
  'hus',
  'fritidshus',
  'ulykke',
  'bil',
  'rejse',
  'andet',
] as const;

export type SupportedPolicyType = typeof SUPPORTED_POLICY_TYPES[number];

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

    // Step 1.2: For "current" policies, archive existing policies of the same type
    // This ensures only one active policy per (userId, policyType) at any time
    if (kind === 'current' && document.userId) {
      // Deduplicate policy types to avoid redundant UPDATE statements
      const policyTypesToArchive = [...new Set(segments.map(s => this.normalizePolicyType(s.policyType)))];
      await this.archiveExistingCurrentPolicies(document.userId, policyTypesToArchive);
    }

    // Step 2.4: For "offer" policies, supersede existing offers from the same company for same policy type
    // This ensures only the latest offer revision is active per (userId, companyName, policyType)
    // We need to do this per-segment since different segments may have different companies
    const offerArchiveMap = new Map<string, { companyName: string; policyType: string }[]>();
    if (kind === 'offer' && document.userId) {
      // Pre-calculate which (companyName, policyType) pairs will be created
      for (const segment of segments) {
        const policyType = this.normalizePolicyType(segment.policyType);
        const companyName = await this.extractCompanyName(segment, document);
        const key = `${companyName}::${policyType}`;
        if (!offerArchiveMap.has(key)) {
          offerArchiveMap.set(key, []);
        }
        offerArchiveMap.get(key)!.push({ companyName, policyType });
      }
      
      // Archive old offers for each unique (companyName, policyType) pair
      for (const [_, pairs] of offerArchiveMap) {
        if (pairs.length > 0) {
          const { companyName, policyType } = pairs[0];
          await this.archiveExistingOfferPolicies(document.userId, companyName, policyType);
        }
      }
    }

    // Create one snapshot per segment
    const snapshots: PolicySnapshot[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      try {
        // Normalize policy type (e.g., "Fritidshus" → "fritidshus", unknown → "unknown")
        const policyType = this.normalizePolicyType(segment.policyType);
        
        // Step 3.3: Determine status based on policy type
        const status = this.determineStatus(policyType);
        
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
          status, // Step 3.3: Mark unknown types so they're skipped in matching
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

        // Step 3.3: Log differently for unknown types
        if (status === 'unknown_type') {
          console.log(
            `[PolicySnapshotService] ⚠ Created snapshot ${snapshot.id}: ` +
            `${kind}/${policyType} from ${companyName} (segment ${i}) - UNKNOWN TYPE, will be skipped in matching`
          );
        } else {
          console.log(
            `[PolicySnapshotService] ✓ Created snapshot ${snapshot.id}: ` +
            `${kind}/${policyType} from ${companyName} (segment ${i})`
          );
        }
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
   * Step 1.2: Archive existing "current" policies of the same type(s) before creating new ones.
   * 
   * This ensures only one active policy per (userId, policyType) at any time.
   * When a user uploads a new version of their indbo policy, the old one becomes archived.
   * 
   * @param userId - The user's ID
   * @param policyTypes - Array of policy types that will be replaced (normalized)
   */
  private async archiveExistingCurrentPolicies(
    userId: string,
    policyTypes: string[]
  ): Promise<void> {
    if (policyTypes.length === 0) return;

    for (const policyType of policyTypes) {
      try {
        const result = await db
          .update(policySnapshots)
          .set({ 
            isActive: false,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(policySnapshots.userId, userId),
              eq(policySnapshots.kind, 'current'),
              eq(policySnapshots.policyType, policyType),
              eq(policySnapshots.isActive, true)
            )
          );

        console.log(
          `[PolicySnapshotService] Archived existing current ${policyType} policies for user ${userId}`
        );
      } catch (error) {
        console.error(
          `[PolicySnapshotService] Failed to archive existing ${policyType} policies:`,
          error
        );
      }
    }
  }

  /**
   * Step 2.4: Archive (supersede) existing "offer" policies from the same company for the same type.
   * 
   * This ensures only one active offer per (userId, companyName, policyType) at any time.
   * When a revised offer arrives for the same insurance type, the old one becomes superseded.
   * 
   * NOTE: Comparison superseding is handled by ComparisonOrchestrator, which checks if
   * offer snapshots are newer than the existing comparison before deciding to supersede.
   * 
   * @param userId - The user's ID
   * @param companyName - The offering company's name
   * @param policyType - The policy type (normalized)
   * @returns Number of archived snapshots (0 if no revision occurred)
   */
  private async archiveExistingOfferPolicies(
    userId: string,
    companyName: string,
    policyType: string
  ): Promise<number> {
    try {
      const archivedSnapshots = await db
        .update(policySnapshots)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(policySnapshots.userId, userId),
            eq(policySnapshots.kind, 'offer'),
            eq(policySnapshots.companyName, companyName),
            eq(policySnapshots.policyType, policyType),
            eq(policySnapshots.isActive, true)
          )
        )
        .returning({ id: policySnapshots.id });

      if (archivedSnapshots.length > 0) {
        console.log(
          `[PolicySnapshotService] Step 2.4: Superseded ${archivedSnapshots.length} existing offer ${policyType} from ${companyName} for user ${userId}`
        );
      }
      
      return archivedSnapshots.length;
    } catch (error) {
      console.error(
        `[PolicySnapshotService] Failed to supersede existing ${policyType} offers from ${companyName}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Normalize policy type from various formats to canonical lowercase.
   * Step 3.3: Returns 'unknown' for types we don't recognize/support.
   * 
   * Examples: "Fritidshus" → "fritidshus", "Indbo" → "indbo", "Ulykke" → "ulykke"
   * Unknown: "Landbrug" → "unknown", "Special" → "unknown"
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
      'villaejerforsikring': 'hus',
      'indbo': 'indbo',
      'indboforsikring': 'indbo',
      'ulykke': 'ulykke',
      'ulykkesforsikring': 'ulykke',
      'bil': 'bil',
      'bilforsikring': 'bil',
      'rejse': 'rejse',
      'rejseforsikring': 'rejse',
    };

    const mappedType = typeMap[normalized];
    
    // If we found a mapping, return the canonical type
    if (mappedType) {
      return mappedType;
    }
    
    // Step 3.3: Check if the raw normalized value is a supported type
    if (SUPPORTED_POLICY_TYPES.includes(normalized as SupportedPolicyType)) {
      return normalized;
    }
    
    // Step 3.3: Return 'unknown' for unsupported types
    // This prevents the entire document from failing when one policy is unrecognized
    console.log(`[PolicySnapshotService] Unknown policy type detected: "${rawType}" → marking as "unknown"`);
    return 'unknown';
  }

  /**
   * Step 3.3: Determine the status field based on policy type.
   * Returns "active" for supported types, "unknown_type" for unsupported.
   */
  private determineStatus(policyType: string): "active" | "unknown_type" {
    if (policyType === 'unknown' || !SUPPORTED_POLICY_TYPES.includes(policyType as SupportedPolicyType)) {
      return 'unknown_type';
    }
    return 'active';
  }

  /**
   * Step 3.3: Check if a policy type is supported (eligible for matching/health checks)
   */
  static isSupportedPolicyType(policyType: string): boolean {
    return SUPPORTED_POLICY_TYPES.includes(policyType as SupportedPolicyType);
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
   * Get all ACTIVE snapshots for a user by kind.
   * For "current" policies, only returns the active (non-archived) ones.
   * For "offer" policies, returns all (offers don't have versioning).
   * 
   * Step 3.3: By default, excludes unknown_type policies (they can't be matched/compared).
   * Use includeUnknown=true for debugging/admin purposes.
   */
  async getSnapshotsByUserAndKind(
    userId: string,
    kind: 'current' | 'offer',
    includeUnknown = false
  ): Promise<PolicySnapshot[]> {
    const conditions = [
      eq(policySnapshots.userId, userId),
      eq(policySnapshots.kind, kind),
      eq(policySnapshots.isActive, true),
    ];
    
    // Step 3.3: Filter out unknown_type policies by default
    if (!includeUnknown) {
      conditions.push(eq(policySnapshots.status, 'active'));
    }
    
    return await db
      .select()
      .from(policySnapshots)
      .where(and(...conditions));
  }

  /**
   * Get ALL ACTIVE snapshots for a user (both current and offer)
   * Ticket B: Used for read-only overview endpoint
   * Only returns active policies (Step 1.2 - archived ones are hidden)
   * 
   * Step 3.3: By default, excludes unknown_type policies.
   * Use includeUnknown=true for debugging/admin purposes.
   */
  async getSnapshotsForUser(userId: string, includeUnknown = false): Promise<PolicySnapshot[]> {
    const conditions = [
      eq(policySnapshots.userId, userId),
      eq(policySnapshots.isActive, true),
    ];
    
    // Step 3.3: Filter out unknown_type policies by default
    if (!includeUnknown) {
      conditions.push(eq(policySnapshots.status, 'active'));
    }
    
    return await db
      .select()
      .from(policySnapshots)
      .where(and(...conditions));
  }

  /**
   * Get ALL snapshots for a user including archived ones
   * Used for admin/debugging purposes
   */
  async getAllSnapshotsForUser(userId: string, includeArchived = false): Promise<PolicySnapshot[]> {
    if (includeArchived) {
      return await db
        .select()
        .from(policySnapshots)
        .where(eq(policySnapshots.userId, userId));
    }
    return this.getSnapshotsForUser(userId);
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

  /**
   * Update a snapshot's pre-computed health check JSON (Ticket A - DB & Pipeline)
   * Called by external flows (n8n, AI agents) via webhook
   */
  async updateHealthCheckJson(
    snapshotId: string,
    healthCheckJson: any
  ): Promise<void> {
    await db
      .update(policySnapshots)
      .set({
        healthCheckJson,
        updatedAt: new Date(),
      })
      .where(eq(policySnapshots.id, snapshotId));

    console.log(`[PolicySnapshotService] Updated health check JSON for snapshot ${snapshotId}`);
  }
}

export const policySnapshotService = new PolicySnapshotService();
