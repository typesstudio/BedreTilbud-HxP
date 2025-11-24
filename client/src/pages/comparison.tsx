import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ComparisonPageLayout } from "@/components/comparison/ComparisonPageLayout";
import { transformCompanyComparisonToViewModel } from "@/utils/transformComparison";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";

export default function Comparison() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const userId = localStorage.getItem("userId");

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id,
  });
  const companyId = (comparison as any)?.companyId;
  
  const { data: threadsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/emails/threads", userId],
    enabled: !!userId,
  });
  const threads = threadsResponse?.data || [];

  // Find thread for this comparison's company
  const thread = threads.find((t: any) => t.companyId === companyId);
  const threadId = thread?.id;

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

  if (!comparison) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Sammenligning ikke fundet</h2>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  // Transform API data to view model
  const viewModel = transformCompanyComparisonToViewModel(comparison);

  return (
    <AppLayoutWithNav userId={userId!}>
      <ComparisonPageLayout
        view={viewModel}
        onSeeMessages={() => threadId && setLocation(`/emails/${threadId}`)}
        onSeeHealthCheck={() => setLocation('/check')}
        onChooseOffer={() => {
          // TODO: Implement choose offer logic
        }}
      />
    </AppLayoutWithNav>
  );
}
