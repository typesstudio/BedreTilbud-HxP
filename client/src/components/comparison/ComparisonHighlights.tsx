import { IconWithBackground } from "@/ui/components/IconWithBackground";
import {
  FeatherTrendingUp,
  FeatherTrendingDown,
  FeatherTruck,
  FeatherDroplet,
} from "@subframe/core";

const iconMap: { [key: string]: any } = {
  "trending-up": FeatherTrendingUp,
  "trending-down": FeatherTrendingDown,
  truck: FeatherTruck,
  droplet: FeatherDroplet,
};

export interface Highlight {
  title: string;
  description: string;
  icon?: string;
  variant?: "success" | "neutral" | "warning" | "error";
}

interface ComparisonHighlightsProps {
  highlights: Highlight[];
  title?: string;
  className?: string;
}

export function ComparisonHighlights({
  highlights,
  title = "Højdepunkter hvor anbefalingen er bedre",
  className = "",
}: ComparisonHighlightsProps) {
  if (!highlights || highlights.length === 0) {
    return null;
  }

  return (
    <div className={`flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4 ${className}`}>
      <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
        {title}
      </span>
      <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-3">
        {highlights.slice(0, 4).map((highlight, index) => {
          const IconComponent = highlight.icon ? iconMap[highlight.icon] || FeatherTrendingUp : FeatherTrendingUp;
          return (
            <div
              key={index}
              className="flex grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-neutral-50 px-4 py-4 mobile:flex-col mobile:flex-nowrap mobile:gap-2"
            >
              <IconWithBackground
                variant={highlight.variant || "success"}
                size="medium"
                icon={<IconComponent />}
                square={true}
              />
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-bold font-body-bold text-default-font">
                  {highlight.title}
                </span>
                <span className="text-caption font-caption text-subtext-color">
                  {highlight.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
