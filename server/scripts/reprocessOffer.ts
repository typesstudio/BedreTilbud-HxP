import { storage } from "../storage";
import { comparisonService } from "../services/comparisonService";
import { PolicyMatchingService } from "../services/policyMatchingService";
import { parsePolicyType } from "../utils/policyExtractionParser";

const OFFER_DOCUMENT_ID = "62c0b9d6-4ab6-4856-99bc-b8d5d28716f0";
const USER_ID = "e86b6430-0013-4fdc-9025-27aefe2d1528";

async function reprocessOffer() {
  console.log("\n🔄 Starting offer reprocessing script...\n");

  try {
    const document = await storage.getDocument(OFFER_DOCUMENT_ID);
    
    if (!document) {
      console.error("❌ Document not found:", OFFER_DOCUMENT_ID);
      process.exit(1);
    }

    console.log("✅ Document found:", document.fileName);
    console.log("   User ID:", document.userId);
    console.log("   Company ID:", document.companyId);
    console.log("   Created at:", document.createdAt);

    const ocrData = document.ocrData as any;
    if (!ocrData || !ocrData.policies || !Array.isArray(ocrData.policies)) {
      console.error("❌ No policies found in OCR data");
      process.exit(1);
    }

    console.log(`\n📋 Found ${ocrData.policies.length} policies in OCR data:`);
    ocrData.policies.forEach((p: any, i: number) => {
      console.log(`   ${i + 1}. ${p.type} - ${p.premium} kr/year`);
    });

    if (!document.companyId) {
      console.error("❌ Document has no company ID");
      process.exit(1);
    }

    // Delete comparisons FIRST (foreign key constraint)
    const existingComparisons = await storage.getComparisonsByUserAndCompany(USER_ID, document.companyId);
    if (existingComparisons.length > 0) {
      console.log(`\n⚠️  Found ${existingComparisons.length} existing comparisons - deleting for clean reprocess...`);
      const { db } = await import("../db");
      const { comparisons } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      for (const comp of existingComparisons) {
        await db.delete(comparisons).where(eq(comparisons.id, comp.id));
        console.log(`   Deleted comparison ${comp.id}`);
      }
    }

    // Then delete policies
    const existingPolicies = await storage.getPoliciesByDocument(OFFER_DOCUMENT_ID);
    
    if (existingPolicies.length > 0) {
      console.log(`\n⚠️  Found ${existingPolicies.length} existing policies - deleting for clean reprocess...`);
      for (const policy of existingPolicies) {
        const { db } = await import("../db");
        const { policies } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(policies).where(eq(policies.id, policy.id));
        console.log(`   Deleted policy ${policy.id} (${policy.policyType})`);
      }
    }

    console.log("\n🔨 Creating policy records...");
    const offerPolicies: any[] = [];
    
    for (const policyData of ocrData.policies) {
      const normalizedType = parsePolicyType(policyData.type);
      console.log(`   Normalizing "${policyData.type}" → "${normalizedType}"`);
      
      const policy = await storage.createPolicy({
        documentId: OFFER_DOCUMENT_ID,
        userId: USER_ID,
        companyId: document.companyId ?? null,
        policyType: normalizedType,
        premium: policyData.premium?.toString(),
        deductible: policyData.deductible?.toString(),
        coverageDetails: policyData,
        isOwnPolicy: false
      });
      offerPolicies.push(policy);
      console.log(`   ✅ Created policy: ${policy.policyType} (ID: ${policy.id})`);
    }

    console.log("\n🔗 Running PolicyMatchingService...");
    const policyMatchingService = new PolicyMatchingService(storage, comparisonService);
    const matchResult = await policyMatchingService.matchAndCompareOfferPolicies(
      USER_ID,
      document.companyId,
      OFFER_DOCUMENT_ID,
      offerPolicies
    );

    console.log("\n📊 Results:");
    console.log(`   ✅ Comparisons created: ${matchResult.matchedComparisons.length}`);
    console.log(`   ℹ️  Health checks created: ${matchResult.unmatchedHealthChecks.length}`);

    if (matchResult.matchedComparisons.length > 0) {
      console.log("\n📋 Created Comparisons:");
      for (const comp of matchResult.matchedComparisons) {
        console.log(`   - ${comp.policyType}: Comparison ID ${comp.id}`);
      }
    }

    console.log("\n✅ Reprocessing complete!\n");
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Error during reprocessing:", error);
    process.exit(1);
  }
}

reprocessOffer();
