import { Button } from "@/ui/components/Button";
import { FeatherCheckCircle, FeatherXCircle } from "@subframe/core";

export interface OfferHighlight {
  id: string;
  title: string;
  isPositive: boolean;
}

export interface OfferInsightsCardProps {
  companyName: string;
  companyLogoUrl?: string | null;
  policyTypes: string[];
  currentPremium: number;
  offerPremium: number;
  monthlySavings: number;
  yearlySavings: number;
  highlights: OfferHighlight[];
  onViewInsurance: () => void;
  onViewComparison: () => void;
}

export function OfferInsightsCard({
  companyName,
  companyLogoUrl,
  policyTypes,
  currentPremium,
  offerPremium,
  monthlySavings,
  yearlySavings,
  highlights,
  onViewInsurance,
  onViewComparison,
}: OfferInsightsCardProps) {
  // Determine offer quality: positive savings = better, negative = worse, zero = neutral (treat as better for now)
  const isBetterOffer = yearlySavings >= 0;
  const displayHighlights = highlights.slice(0, 4);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const policyTypeLabels: { [key: string]: string } = {
    indbo: "Indboforsikring",
    ulykke: "Ulykke",
    hus: "Hus",
    fritidshus: "Fritidshus",
    bil: "Bil",
    rejse: "Rejse",
  };

  const policyLabelsDisplay = policyTypes
    .map((p) => policyTypeLabels[p] || p)
    .join(" · ");

  return (
    <div
      className={`flex w-full flex-col items-start gap-4 rounded-lg border border-solid ${
        isBetterOffer
          ? "border-brand-200 bg-white"
          : "border-error-200 bg-default-background"
      } px-6 py-6 shadow-sm`}
      data-testid={`offer-card-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 flex-none rounded-lg bg-neutral-200 overflow-hidden flex items-center justify-center">
            {companyLogoUrl ? (
              <img
                className="h-full w-full object-cover"
                src={companyLogoUrl}
                alt={`${companyName} logo`}
              />
            ) : (
              <div className="h-full w-full bg-neutral-300 flex items-center justify-center">
                <span className="text-neutral-500 text-caption font-caption">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <span
              className="text-heading-2 font-heading-2 text-default-font"
              data-testid={`text-company-name-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {companyName}
            </span>
            <span className="text-caption font-caption text-subtext-color">
              {policyLabelsDisplay}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-caption font-caption text-subtext-color">
            {isBetterOffer ? "Årlig besparelse" : "Årlig Prisstigning"}
          </span>
          <span
            className={`text-heading-1 font-heading-1 ${
              isBetterOffer ? "text-brand-600" : "text-error-600"
            }`}
            data-testid={`text-savings-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {!isBetterOffer && yearlySavings < 0 ? "-" : ""}
            {formatCurrency(Math.abs(yearlySavings))} kr
          </span>
        </div>
      </div>

      <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />

      <div className="flex w-full items-start gap-6 mobile:flex-col mobile:gap-4">
        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 mobile:w-full">
          <span className="text-body-bold font-body-bold text-default-font">
            Højdepunkter
          </span>
          <div className="flex flex-col items-start gap-2">
            {displayHighlights.map((highlight) => (
              <div
                key={highlight.id}
                className="flex items-center gap-2"
                data-testid={`highlight-${highlight.id}`}
              >
                {highlight.isPositive ? (
                  <FeatherCheckCircle className="text-body font-body text-success-600 flex-shrink-0" />
                ) : (
                  <FeatherXCircle className="text-body font-body text-error-600 flex-shrink-0" />
                )}
                <span className="text-body font-body text-default-font">
                  {highlight.title}
                </span>
              </div>
            ))}
            {displayHighlights.length === 0 && (
              <span className="text-body font-body text-subtext-color">
                Ingen højdepunkter tilgængelige
              </span>
            )}
          </div>
        </div>

        <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 mobile:w-full">
          <span className="text-body-bold font-body-bold text-default-font">
            Nøgleforskelle
          </span>
          <div className="flex w-full flex-col items-start gap-2 rounded-md">
            <div className="flex w-full items-center justify-between">
              <span className="text-body font-body text-subtext-color">
                Nuværende præmie
              </span>
              <span className="text-body font-body text-default-font">
                {formatCurrency(currentPremium)} kr/år
              </span>
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-body-bold font-body-bold text-default-font">
                Nyt tilbud
              </span>
              <span className="text-body-bold font-body-bold text-default-font">
                {formatCurrency(offerPremium)} kr/år
              </span>
            </div>
            <div className="flex w-full items-center justify-between">
              <span
                className={`text-body font-body ${
                  isBetterOffer ? "text-brand-600" : "text-error-600"
                }`}
              >
                {isBetterOffer ? "Månedlig besparelse" : "Månedlig prisstigning"}
              </span>
              <span
                className={`text-body font-body ${
                  isBetterOffer ? "text-brand-600" : "text-error-600"
                }`}
              >
                {formatCurrency(Math.abs(monthlySavings))} kr
              </span>
            </div>
            <div className="flex w-full items-center justify-between">
              <span
                className={`text-body font-body ${
                  isBetterOffer ? "text-brand-600" : "text-error-600"
                }`}
              >
                {isBetterOffer ? "Årlig besparelse" : "Årlig prisstigning"}
              </span>
              <span
                className={`text-body font-body ${
                  isBetterOffer ? "text-brand-600" : "text-error-600"
                }`}
              >
                {formatCurrency(Math.abs(yearlySavings))} kr
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-end gap-2 mobile:flex-col">
        <Button
          className="h-8 grow shrink-0 basis-0 mobile:w-full"
          variant={isBetterOffer ? "brand-secondary" : "neutral-secondary"}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onViewInsurance();
          }}
          data-testid={`button-view-insurance-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
        >
          Se forsikringen
        </Button>
        <Button
          className="h-8 grow shrink-0 basis-0 mobile:w-full"
          variant={isBetterOffer ? "brand-primary" : "neutral-primary"}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onViewComparison();
          }}
          data-testid={`button-view-comparison-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
        >
          Se sammenligning
        </Button>
      </div>
    </div>
  );
}

export interface PendingOfferCardProps {
  companyName: string;
  companyLogoUrl?: string | null;
  policyTypes: string[];
  status: "pending" | "fetching";
  statusText?: string;
}

export function PendingOfferCard({
  companyName,
  companyLogoUrl,
  policyTypes,
  status,
  statusText,
}: PendingOfferCardProps) {
  const policyTypeLabels: { [key: string]: string } = {
    indbo: "Indboforsikring",
    ulykke: "Ulykke",
    hus: "Hus",
    fritidshus: "Fritidshus",
    bil: "Bil",
    rejse: "Rejse",
  };

  const policyLabelsDisplay = policyTypes
    .map((p) => policyTypeLabels[p] || p)
    .join(" · ");

  return (
    <div
      className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm"
      data-testid={`pending-card-${companyName.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 flex-none rounded-lg bg-neutral-200 overflow-hidden flex items-center justify-center">
            {companyLogoUrl ? (
              <img
                className="h-full w-full object-cover grayscale"
                src={companyLogoUrl}
                alt={`${companyName} logo`}
              />
            ) : (
              <div className="h-full w-full bg-neutral-300 flex items-center justify-center">
                <span className="text-neutral-500 text-caption font-caption">
                  {companyName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-heading-2 font-heading-2 text-default-font">
              {companyName}
            </span>
            <span className="text-caption font-caption text-subtext-color">
              {policyLabelsDisplay} · Tilbud indhentes
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-body font-body text-subtext-color">
            {statusText || (status === "fetching" ? "Forhandler tilbud..." : "Afventer svar...")}
          </span>
        </div>
      </div>
    </div>
  );
}
