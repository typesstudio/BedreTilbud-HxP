import { useParams, useLocation } from "wouter";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { usePolicyHealthCheck } from "@/hooks/usePolicyHealthCheck";
import { Button } from "@/ui/components/Button";
import { ListingsTabs } from "@/ui/components/ListingsTabs";
import { ComparisonHeader } from "@/components/comparison/ComparisonHeader";
import { ComparisonDetailedMatrix } from "@/components/comparison/ComparisonDetailedMatrix";
import { HealthCheckAnnualPotentialCard } from "@/components/healthCheck/HealthCheckAnnualPotentialCard";
import { HealthCheckBenefitsGrid } from "@/components/healthCheck/HealthCheckBenefitsGrid";
import { HealthCheckStrengthsWeaknesses } from "@/components/healthCheck/HealthCheckStrengthsWeaknesses";
import { HealthCheckSavingsSection } from "@/components/healthCheck/HealthCheckSavingsSection";
import { 
  FeatherHome, 
  FeatherShield, 
  FeatherBuilding, 
  FeatherCar, 
  FeatherPlane,
  FeatherArrowLeft,
  FeatherSunrise
} from "@subframe/core";

const policyTypeIcons: Record<string, React.ReactNode> = {
  indbo: <FeatherHome />,
  ulykke: <FeatherShield />,
  hus: <FeatherBuilding />,
  fritidshus: <FeatherSunrise />,
  bil: <FeatherCar />,
  rejse: <FeatherPlane />,
};

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
          {/* Back button */}
          <Button
            variant="neutral-tertiary"
            icon={<FeatherArrowLeft />}
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            Tilbage
          </Button>

          {/* Header */}
          <ComparisonHeader
            title={data.title}
            subtitle={data.subtitle}
            activeTab={data.policyType as any}
            onClickDetails={undefined}
            onClickMessages={undefined}
          />

          {/* Dynamic Tabs - only show tabs that exist in this document bundle */}
          {data.siblingTabs && data.siblingTabs.length > 0 && (
            <div className="flex w-full flex-col items-start gap-2 border-b border-solid border-neutral-border bg-default-background sticky top-0 z-20">
              <div className="flex w-full items-center gap-2 overflow-x-auto">
                <ListingsTabs>
                  {data.siblingTabs.map((tab) => (
                    <ListingsTabs.Item
                      key={tab.snapshotId}
                      checked={tab.isActive}
                      icon={policyTypeIcons[tab.policyType]}
                      onClick={() => {
                        if (!tab.isActive) {
                          setLocation(`/sundhedstjek/${tab.snapshotId}`);
                        }
                      }}
                      data-testid={`tab-${tab.policyType}`}
                    >
                      {tab.label}
                    </ListingsTabs.Item>
                  ))}
                </ListingsTabs>
              </div>
            </div>
          )}

          {/* Annual Potential Savings - always show, component handles 0 values */}
          <HealthCheckAnnualPotentialCard
            annualPotentialSavings={data.annualPotentialSavings || 0}
            annualSavingsPercent={data.annualSavingsPercent}
          />

          {/* Benefits Grid */}
          {data.benefits && data.benefits.length > 0 && (
            <HealthCheckBenefitsGrid benefits={data.benefits} />
          )}

          {/* Coverage Matrix (single column) */}
          {data.coverageRows && data.coverageRows.length > 0 && (
            <ComparisonDetailedMatrix
              title="Hvad er inkluderet"
              singleColumn={true}
              singleColumnName={data.companyName}
              coverageRows={data.coverageRows}
            />
          )}

          {/* Strengths & Weaknesses - always show, component handles empty states */}
          <HealthCheckStrengthsWeaknesses
            strengths={data.strengths || []}
            weaknesses={data.weaknesses || []}
          />

          {/* Savings Chart */}
          {data.savingsOverTime && (
            <HealthCheckSavingsSection 
              savingsOverTime={data.savingsOverTime}
              policyType={data.policyType}
              policyTypeLabel={data.policyTypeLabel}
            />
          )}

          {/* Footer CTA */}
          <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 mobile:px-4 mobile:py-4">
            <Button
              className="w-full"
              size="large"
              onClick={() => {}}
              data-testid="button-choose-and-switch"
            >
              Vælg og skift til {data.companyName}
            </Button>
            <span className="text-caption font-caption text-subtext-color text-center w-full">
              Sikre data. Du kan annullere når som helst før aktivering.
            </span>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
