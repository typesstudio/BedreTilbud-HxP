import { db } from "../db";
import {
  users,
  documents,
  offerSnapshots,
  healthChecks,
  companyComparisons,
  comparisons,
  policies,
  emailThreads,
  emails,
  householdMembers,
  onboardingProgress,
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * RESET TEST USER
 * 
 * Safely deletes all insurance-related data for a single test user
 * without deleting the user row itself.
 * 
 * USAGE:
 *   npx tsx server/scripts/resetTestUser.ts [userEmail]
 * 
 * EXAMPLE:
 *   npx tsx server/scripts/resetTestUser.ts hello@vyork.dk
 *   npx tsx server/scripts/resetTestUser.ts
 * 
 * WHAT IT DOES:
 * 1. Looks up user by email
 * 2. Shows dry-run preview of rows to be deleted
 * 3. Deletes all user data in proper FK order:
 *    - emails
 *    - comparisons (old)
 *    - company_comparisons
 *    - health_checks
 *    - offer_snapshots
 *    - policies
 *    - email_threads
 *    - household_members
 *    - onboarding_progress
 *    - documents
 * 4. Verifies all counts are now 0
 * 
 * SAFETY:
 * - Does NOT delete from users table
 * - Does NOT delete from companies table
 * - Only removes rows tied to this user_id
 */

const DEFAULT_EMAIL = 'hello@vyork.dk';

// Get email from CLI args or use default
const userEmail = process.argv[2] || DEFAULT_EMAIL;

// ========================================
// Step 1: Resolve User ID
// ========================================
async function resolveUserId(): Promise<string | null> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RESOLVING USER`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`Looking up user: ${userEmail}`);

  const matchingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1);

  if (matchingUsers.length === 0) {
    console.error(`\n❌ User not found: ${userEmail}`);
    console.error(`Please check the email address and try again.\n`);
    return null;
  }

  const user = matchingUsers[0];
  console.log(`✅ Found user ${user.email} with id ${user.id}\n`);

  return user.id;
}

// ========================================
// Step 2: Count Rows (Dry Run)
// ========================================
async function countUserData(userId: string) {
  console.log(`${'='.repeat(80)}`);
  console.log(`DRY RUN PREVIEW`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Counting rows for user ${userId}...\n`);

  // Count documents
  const docsCount = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId));

  // Count offer_snapshots
  const snapshotsCount = await db
    .select()
    .from(offerSnapshots)
    .where(eq(offerSnapshots.userId, userId));

  // Count health_checks
  const healthChecksCount = await db
    .select()
    .from(healthChecks)
    .where(eq(healthChecks.userId, userId));

  // Count company_comparisons
  const companyComparisonsCount = await db
    .select()
    .from(companyComparisons)
    .where(eq(companyComparisons.userId, userId));

  // Count comparisons (old)
  const comparisonsCount = await db
    .select()
    .from(comparisons)
    .where(eq(comparisons.userId, userId));

  // Count policies
  const policiesCount = await db
    .select()
    .from(policies)
    .where(eq(policies.userId, userId));

  // Count email_threads
  const emailThreadsCount = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.userId, userId));

  // Count emails (via threads)
  const emailsCount = await db
    .select()
    .from(emails)
    .innerJoin(emailThreads, eq(emails.threadId, emailThreads.id))
    .where(eq(emailThreads.userId, userId));

  // Count household_members
  const householdMembersCount = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));

  // Count onboarding_progress
  const onboardingProgressCount = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.userId, userId));

  const counts = {
    documents: docsCount.length,
    offerSnapshots: snapshotsCount.length,
    healthChecks: healthChecksCount.length,
    companyComparisons: companyComparisonsCount.length,
    comparisons: comparisonsCount.length,
    policies: policiesCount.length,
    emailThreads: emailThreadsCount.length,
    emails: emailsCount.length,
    householdMembers: householdMembersCount.length,
    onboardingProgress: onboardingProgressCount.length,
  };

  console.log(`📊 Rows to be deleted:\n`);
  console.log(`  - documents:           ${counts.documents}`);
  console.log(`  - offer_snapshots:     ${counts.offerSnapshots}`);
  console.log(`  - health_checks:       ${counts.healthChecks}`);
  console.log(`  - company_comparisons: ${counts.companyComparisons}`);
  console.log(`  - comparisons:         ${counts.comparisons}`);
  console.log(`  - policies:            ${counts.policies}`);
  console.log(`  - email_threads:       ${counts.emailThreads}`);
  console.log(`  - emails:              ${counts.emails}`);
  console.log(`  - household_members:   ${counts.householdMembers}`);
  console.log(`  - onboarding_progress: ${counts.onboardingProgress}`);
  console.log();

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(`📦 Total rows to delete: ${total}\n`);

  return counts;
}

// ========================================
// Step 3: Delete User Data
// ========================================
async function deleteUserData(userId: string) {
  console.log(`${'='.repeat(80)}`);
  console.log(`DELETING USER DATA`);
  console.log(`${'='.repeat(80)}\n`);

  let deletedCount = 0;

  // 1. Delete emails (depends on email_threads)
  console.log(`1️⃣ Deleting emails...`);
  const emailThreadIds = await db
    .select({ id: emailThreads.id })
    .from(emailThreads)
    .where(eq(emailThreads.userId, userId));
  
  if (emailThreadIds.length > 0) {
    const threadIds = emailThreadIds.map(t => t.id);
    for (const threadId of threadIds) {
      const deleted = await db.delete(emails).where(eq(emails.threadId, threadId));
      deletedCount++;
    }
  }
  console.log(`   ✅ Emails deleted\n`);

  // 2. Delete comparisons (old - depends on policies and documents)
  console.log(`2️⃣ Deleting comparisons (old)...`);
  await db.delete(comparisons).where(eq(comparisons.userId, userId));
  console.log(`   ✅ Comparisons deleted\n`);

  // 3. Delete company_comparisons
  console.log(`3️⃣ Deleting company_comparisons...`);
  await db.delete(companyComparisons).where(eq(companyComparisons.userId, userId));
  console.log(`   ✅ Company comparisons deleted\n`);

  // 4. Delete health_checks (depends on offer_snapshots)
  console.log(`4️⃣ Deleting health_checks...`);
  await db.delete(healthChecks).where(eq(healthChecks.userId, userId));
  console.log(`   ✅ Health checks deleted\n`);

  // 5. Delete offer_snapshots (depends on policies and documents)
  console.log(`5️⃣ Deleting offer_snapshots...`);
  await db.delete(offerSnapshots).where(eq(offerSnapshots.userId, userId));
  console.log(`   ✅ Offer snapshots deleted\n`);

  // 6. Delete policies (depends on documents)
  console.log(`6️⃣ Deleting policies...`);
  await db.delete(policies).where(eq(policies.userId, userId));
  console.log(`   ✅ Policies deleted\n`);

  // 7. Delete email_threads
  console.log(`7️⃣ Deleting email_threads...`);
  await db.delete(emailThreads).where(eq(emailThreads.userId, userId));
  console.log(`   ✅ Email threads deleted\n`);

  // 8. Delete household_members
  console.log(`8️⃣ Deleting household_members...`);
  await db.delete(householdMembers).where(eq(householdMembers.userId, userId));
  console.log(`   ✅ Household members deleted\n`);

  // 9. Delete onboarding_progress
  console.log(`9️⃣ Deleting onboarding_progress...`);
  await db.delete(onboardingProgress).where(eq(onboardingProgress.userId, userId));
  console.log(`   ✅ Onboarding progress deleted\n`);

  // 10. Delete documents (base table)
  console.log(`🔟 Deleting documents...`);
  await db.delete(documents).where(eq(documents.userId, userId));
  console.log(`   ✅ Documents deleted\n`);
}

// ========================================
// Step 4: Verify Deletion
// ========================================
async function verifyDeletion(userId: string) {
  console.log(`${'='.repeat(80)}`);
  console.log(`VERIFICATION`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Verifying all data has been deleted...\n`);

  const counts = await countUserData(userId);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    console.log(`✅ SUCCESS: All user data has been deleted\n`);
    return true;
  } else {
    console.error(`❌ FAILED: ${total} rows still remain\n`);
    return false;
  }
}

// ========================================
// Main
// ========================================
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`RESET TEST USER - ${userEmail}`);
  console.log(`${'='.repeat(80)}\n`);

  // Step 1: Resolve user ID
  const userId = await resolveUserId();
  if (!userId) {
    process.exit(1);
  }

  // Step 2: Show dry run
  const counts = await countUserData(userId);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    console.log(`ℹ️ No data to delete for user ${userEmail}\n`);
    process.exit(0);
  }

  // Step 3: Delete user data
  await deleteUserData(userId);

  // Step 4: Verify deletion
  const success = await verifyDeletion(userId);

  if (success) {
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ Reset completed for user ${userEmail} (${userId})`);
    console.log(`${'='.repeat(80)}\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ Reset failed - some data remains\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
