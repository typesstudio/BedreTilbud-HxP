import { useParams, useLocation } from "wouter";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { HealthCheckLayout } from "@/components/health/HealthCheckLayout";
import { usePolicyHealthCheck } from "@/hooks/usePolicyHealthCheck";
import { Button } from "@/ui";
import { FeatherArrowLeft } from "@subframe/core";

export default function PolicyHealthCheckPage() {
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const [, setLocation] = useLocation();
  const userId = localStorage.getItem("userId") || "";

  const { data, isLoading, error } = usePolicyHealthCheck(snapshotId);

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen bg-default-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (error || !data) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex items-center justify-center min-h-screen bg-default-background">
          <div className="flex flex-col items-center gap-4 px-4">
            <span className="text-heading-2 font-heading-2 text-default-font">
              Der opstod en fejl
            </span>
            <span className="text-body font-body text-subtext-color text-center">
              Kunne ikke hente sundhedstjek data. Prøv venligst igen.
            </span>
            <Button onClick={() => window.history.back()} data-testid="button-go-back">
              Gå tilbage
            </Button>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-4 py-4 mobile:px-3 mobile:py-3">
        {/* Back button */}
        <div className="flex w-full max-w-[768px] items-start pb-4">
          <Button
            variant="neutral"
            icon={<FeatherArrowLeft />}
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            Tilbage
          </Button>
        </div>

        {/* Health Check Layout */}
        <HealthCheckLayout {...data} />
      </div>
    </AppLayoutWithNav>
  );
}
