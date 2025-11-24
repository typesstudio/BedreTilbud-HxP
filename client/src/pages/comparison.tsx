import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonTabs } from "@/components/comparison/ComparisonTabs";
import { ComparisonSummaryRow } from "@/components/comparison/ComparisonSummaryRow";
import { ComparisonQuickTable } from "@/components/comparison/ComparisonQuickTable";
import { ComparisonDetailedMatrix } from "@/components/comparison/ComparisonDetailedMatrix";
import { ComparisonSavingsChart } from "@/components/comparison/ComparisonSavingsChart";
import { transformCompanyComparisonToViewModel } from "@/utils/transformComparison";

export default function Comparison() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [selectedTab, setSelectedTab] = useState("samlet");
  const userId = localStorage.getItem("userId");

  // Fetch comparison data
  const { data: comparison, isLoading } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id,
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
  if (!comparison) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">
              Sammenligning ikke fundet
            </h2>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  // Transform to view model
  const viewModel = transformCompanyComparisonToViewModel(comparison);
  
  // Find thread for messaging
  const companyId = (comparison as any)?.companyId;
  const thread = threads.find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

  // Filter data based on selected tab
  const filteredPolicies = selectedTab === "samlet"
    ? viewModel.policies
    : viewModel.policies.filter(p => p.policyType === selectedTab);

  const filteredCoverageRows = selectedTab === "samlet"
    ? viewModel.coverageRows
    : viewModel.coverageRows; // TODO: Filter by policy type if needed

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
          
          {/* Header with buttons and tabs */}
          <ComparisonHeader
            title={`${viewModel.offerCompanyName} sammenligning`}
            subtitle="Sammenlign og gennemgå forsikringstilbud tilpasset dig"
            onSeBeskederClick={() => threadId && setLocation(`/emails/${threadId}`)}
            onSeSundhedstjekClick={() => setLocation("/check")}
            showBeskederButton={!!threadId}
            showSundhedstjekButton={true}
          />

          {/* Tabs */}
          <ComparisonTabs
            selectedTab={selectedTab}
            onTabChange={(tab) => setSelectedTab(tab)}
          />

          {/* Summary Cards */}
          <ComparisonSummaryRow
            overall={viewModel.overall}
            currentCompanyName={viewModel.currentCompanyName}
            offerCompanyName={viewModel.offerCompanyName}
          />

          {/* Quick Comparison Table */}
          <ComparisonQuickTable
            policies={filteredPolicies}
            onSelectPolicy={(policyType) => setSelectedTab(policyType)}
          />

          {/* Savings Chart */}
          {selectedTab === "samlet" && (
            <ComparisonSavingsChart overall={viewModel.overall} />
          )}

          {/* Detailed Coverage Matrix */}
          <ComparisonDetailedMatrix
            currentCompanyName={viewModel.currentCompanyName}
            offerCompanyName={viewModel.offerCompanyName}
            coverageRows={filteredCoverageRows}
          />

        </div>
      </div>
    </AppLayoutWithNav>
  );
}
