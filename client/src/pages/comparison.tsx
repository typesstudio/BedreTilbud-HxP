import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonTabs } from "@/components/comparison/ComparisonTabs";
import { ComparisonSummaryRow } from "@/components/comparison/ComparisonSummaryRow";
import { ComparisonQuickTable } from "@/components/comparison/ComparisonQuickTable";
import { ComparisonAnnualCost } from "@/components/comparison/ComparisonAnnualCost";
import { ComparisonHighlights } from "@/components/comparison/ComparisonHighlights";
import { ComparisonDetailedMatrix } from "@/components/comparison/ComparisonDetailedMatrix";
import { ComparisonSavingsSection } from "@/components/comparison/ComparisonSavingsSection";
import { transformCompanyComparisonToViewModel, type ComparisonTabKey } from "@/utils/transformComparison";

export default function Comparison() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ComparisonTabKey>("samlet");
  const userId = localStorage.getItem("userId");

  // Fetch comparison data
  const { data: comparison, isLoading, error } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id && !!userId,
  });

  // Fetch email threads for messaging
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });
  const threads = threadsResponse?.data || [];

  // Loading state
  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-body font-body text-subtext-color">Indlæser sammenligning...</p>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  // Error state
  if (error || !comparison) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">
              Sammenligning ikke fundet
            </h2>
            <p className="text-body font-body text-subtext-color mb-4">
              {error ? "Der opstod en fejl" : "Denne sammenligning eksisterer ikke"}
            </p>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  // Transform to view model
  const viewModel = transformCompanyComparisonToViewModel(comparison);
  
  // Get active tab view
  const activeView = viewModel.tabs[activeTab];
  
  // Calculate available tabs (samlet is always available, plus any policy tabs with data)
  const availableTabs: ComparisonTabKey[] = ["samlet"];
  (["indbo", "hus", "ulykke", "bil", "rejse"] as ComparisonTabKey[]).forEach((tabKey) => {
    if (viewModel.tabs[tabKey]?.isAvailable) {
      availableTabs.push(tabKey);
    }
  });
  
  // Find thread for messaging
  const companyId = (comparison as any)?.companyId;
  const thread = threads.find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          {/* Header with buttons and tabs */}
          <ComparisonHeader
            title={`${viewModel.offerCompanyName} sammenligning`}
            subtitle="Sammenlign og gennemgå forsikringstilbud tilpasset dig"
            onSeDetaljerClick={() => {
              // Navigate to health check for current tab's offer snapshot
              const snapshotId = activeView.offerSnapshotId || activeView.currentSnapshotId;
              if (snapshotId) {
                setLocation(`/sundhedstjek/${snapshotId}`);
              }
            }}
            onSeBeskederClick={() => threadId && setLocation(`/emails/${threadId}`)}
            showDetaljerButton={activeTab !== "samlet" && !!(activeView.offerSnapshotId || activeView.currentSnapshotId)}
            showBeskederButton={!!threadId}
          />

          {/* Tabs */}
          <ComparisonTabs
            selectedTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as ComparisonTabKey)}
            availableTabs={availableTabs}
          />

          {/* Summary Cards - use activeView data */}
          <ComparisonSummaryRow
            overall={{
              companyName: viewModel.offerCompanyName,
              annualSavings: activeView.summary.annualSavings,
              totalCurrentAnnual: activeView.summary.totalCurrentAnnual,
              totalOfferAnnual: activeView.summary.totalOfferAnnual,
              savingsPercent: activeView.summary.savingsPercent,
            }}
            currentCompanyName={viewModel.currentCompanyName}
            offerCompanyName={viewModel.offerCompanyName}
          />

          {/* Quick Comparison Table for Samlet tab only */}
          {activeTab === "samlet" && (
            <ComparisonQuickTable
              policies={activeView.quickRows}
              onSelectPolicy={(policyType) => setActiveTab(policyType as ComparisonTabKey)}
            />
          )}

          {/* Annual Cost Comparison for individual policy tabs */}
          {activeTab !== "samlet" && activeView.isAvailable && (
            <ComparisonAnnualCost
              currentCompanyName={viewModel.currentCompanyName}
              offerCompanyName={viewModel.offerCompanyName}
              currentAnnual={activeView.summary.totalCurrentAnnual}
              offerAnnual={activeView.summary.totalOfferAnnual}
              annualSavings={activeView.summary.annualSavings}
              savingsPercent={activeView.summary.savingsPercent}
            />
          )}

          {/* Highlights Section */}
          {activeView.highlights.length > 0 && (
            <ComparisonHighlights highlights={activeView.highlights} />
          )}

          {/* Detailed Coverage Matrix */}
          {activeView.coverageRows.length > 0 && (
            <ComparisonDetailedMatrix
              currentCompanyName={viewModel.currentCompanyName}
              offerCompanyName={viewModel.offerCompanyName}
              coverageRows={activeView.coverageRows}
            />
          )}

          {/* Savings Over Time */}
          {activeView.savingsOverTime && (
            <ComparisonSavingsSection 
              savings={activeView.savingsOverTime} 
              activePolicyKey={activeTab === "samlet" ? "all" : activeTab}
            />
          )}

        </div>
      </div>
    </AppLayoutWithNav>
  );
}
