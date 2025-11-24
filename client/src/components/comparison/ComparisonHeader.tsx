import { Button } from "@/ui/components/Button";

interface ComparisonHeaderProps {
  title?: string;
  subtitle?: string;
  onSeDetaljerClick?: () => void;
  onSeBeskederClick?: () => void;
  onSeSundhedstjekClick?: () => void;
  showDetaljerButton?: boolean;
  showBeskederButton?: boolean;
  showSundhedstjekButton?: boolean;
  className?: string;
}

export function ComparisonHeader({
  title = "Tryg sammenligning",
  subtitle = "Compare and review insurance offers tailored for you",
  onSeDetaljerClick,
  onSeBeskederClick,
  onSeSundhedstjekClick,
  showDetaljerButton = false,
  showBeskederButton = false,
  showSundhedstjekButton = false,
  className = "",
}: ComparisonHeaderProps) {
  return (
    <div className={`flex w-full items-start gap-2 px-2 py-2 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-2 ${className}`}>
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2 mobile:px-0 mobile:py-0">
        <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2">
          {title}
        </span>
        <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
          {subtitle}
        </span>
      </div>
      <div className="flex items-center gap-2 mobile:w-full mobile:flex-col">
        {showSundhedstjekButton && (
          <Button
            className="mobile:w-full"
            variant="brand-secondary"
            onClick={onSeSundhedstjekClick}
            data-testid="button-view-healthcheck"
          >
            Se sundhedstjek
          </Button>
        )}
        {showDetaljerButton && (
          <Button
            variant="neutral-primary"
            onClick={onSeDetaljerClick}
            data-testid="button-view-details"
          >
            Se detaljer
          </Button>
        )}
        {showBeskederButton && (
          <Button
            className="mobile:w-full"
            variant="brand-secondary"
            onClick={onSeBeskederClick}
            data-testid="button-view-messages"
          >
            Se beskeder
          </Button>
        )}
      </div>
    </div>
  );
}
