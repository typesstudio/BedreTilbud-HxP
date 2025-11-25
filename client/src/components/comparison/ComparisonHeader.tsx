import { Button } from "@/ui/components/Button";

export type ComparisonTab = "samlet" | "indbo" | "hus" | "ulykke" | "bil" | "rejse";

interface ComparisonHeaderProps {
  title: string;
  subtitle: string;
  activeTab: ComparisonTab;
  onClickDetails?: () => void;
  onClickMessages?: () => void;
  canOpenMessages?: boolean;
}

export function ComparisonHeader({
  title,
  subtitle,
  activeTab,
  onClickDetails,
  onClickMessages,
  canOpenMessages = true,
}: ComparisonHeaderProps) {
  const showDetails = activeTab !== "samlet" && !!onClickDetails;
  const showMessages = !!onClickMessages;

  return (
    <div className="flex w-full items-start gap-2 px-2 py-2 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-0 mobile:py-2">
      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2 px-2 py-2 mobile:px-0 mobile:py-0">
        <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2 mobile:font-heading-2">
          {title}
        </span>
        <span className="text-body font-body text-subtext-color mobile:text-caption mobile:font-caption">
          {subtitle}
        </span>
      </div>

      {showDetails && (
        <Button
          variant="neutral-primary"
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onClickDetails?.();
          }}
          data-testid="button-view-details"
        >
          Se detaljer
        </Button>
      )}

      {showMessages && (
        <Button
          className="mobile:w-full"
          variant="brand-secondary"
          disabled={!canOpenMessages}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (!canOpenMessages) return;
            onClickMessages?.();
          }}
          data-testid="button-view-messages"
        >
          Se beskeder
        </Button>
      )}
    </div>
  );
}
