import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { ComparisonHighlightView } from "@/utils/transformComparison";
import {
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherTruck,
  FeatherDroplet,
} from "@subframe/core";

interface ComparisonHighlightsProps {
  highlights: ComparisonHighlightView[];
}

function iconForHighlight(h: ComparisonHighlightView) {
  switch (h.kind) {
    case "coverage_up":
      return <FeatherTrendingUp />;
    case "deductible_down":
      return <FeatherTrendingDown />;
    case "service_extra":
      return <FeatherTruck />;
    case "tech_extra":
      return <FeatherDroplet />;
    default:
      return <FeatherTrendingUp />;
  }
}

export function ComparisonHighlights({ highlights }: ComparisonHighlightsProps) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
      <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
        Højdepunkter hvor anbefalingen er bedre
      </span>
      <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
        {highlights.map((h) => (
          <div
            key={h.id}
            className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 mobile:flex-col mobile:flex-nowrap mobile:gap-2"
            data-testid={`highlight-${h.id}`}
          >
            <IconWithBackground
              variant="success"
              size="medium"
              icon={iconForHighlight(h)}
              square={true}
            />
            <div className="flex flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                {h.title}
              </span>
              {h.description && (
                <span className="text-caption font-caption text-subtext-color">
                  {h.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
