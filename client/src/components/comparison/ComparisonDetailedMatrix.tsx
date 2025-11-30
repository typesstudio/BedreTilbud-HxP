import { Badge } from "@/ui/components/Badge";
import { ComparisonCoverageRowView } from "@/utils/transformComparison";

interface ComparisonDetailedMatrixProps {
  currentCompanyName?: string;
  offerCompanyName?: string;
  coverageRows: ComparisonCoverageRowView[];
  title?: string;
  singleColumn?: boolean;
  singleColumnName?: string;
}

export function ComparisonDetailedMatrix({
  currentCompanyName,
  offerCompanyName,
  coverageRows,
  title = "Detaljeret sammenligning",
  singleColumn = false,
  singleColumnName,
}: ComparisonDetailedMatrixProps) {
  if (!coverageRows || coverageRows.length === 0) return null;

  const isSingleColumn = singleColumn || (!currentCompanyName && !offerCompanyName);
  const columnName = singleColumnName || offerCompanyName || currentCompanyName || "";

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6 mobile:flex-col mobile:flex-nowrap mobile:gap-3 mobile:px-4 mobile:py-4">
      <span className="text-heading-3 font-heading-3 text-default-font mobile:text-body-bold mobile:font-body-bold">
        {title}
      </span>
      <div className="flex w-full items-start overflow-x-auto">
        <div className="flex w-full min-w-[576px] grow shrink-0 basis-0 flex-col items-start">
          {/* Header row */}
          <div className="flex w-full items-center gap-4 border-b-2 border-solid border-neutral-300 bg-neutral-50 pb-3 sticky top-0 z-10">
            <div className="flex w-48 flex-none flex-col items-start mobile:h-auto mobile:w-32 mobile:flex-none">
              <span className="text-caption-bold font-caption-bold text-subtext-color">
                Dækning
              </span>
            </div>
            {isSingleColumn ? (
              <div className="flex grow shrink-0 basis-0 flex-col items-center">
                <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                  {columnName}
                </span>
              </div>
            ) : (
              <>
                <div className="flex grow shrink-0 basis-0 flex-col items-center">
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                    Nuværende
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {currentCompanyName}
                  </span>
                </div>
                <div className="flex grow shrink-0 basis-0 flex-col items-center">
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-caption-bold mobile:font-caption-bold">
                    Nyt tilbud
                  </span>
                  <span className="text-caption font-caption text-subtext-color">
                    {offerCompanyName}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Rows */}
          {coverageRows.map((row, idx) => {
            const isLast = idx === coverageRows.length - 1;
            return (
              <div
                key={`${row.coverageLabel}-${idx}`}
                className={`flex w-full items-center gap-4 ${
                  isLast
                    ? "py-4"
                    : "border-b border-solid border-neutral-border py-4"
                }`}
                data-testid={`coverage-row-${idx}`}
              >
                <div className="flex w-48 flex-none flex-col items-start gap-1 mobile:w-32">
                  <span className="text-body-bold font-body-bold text-default-font mobile:text-body mobile:font-body">
                    {row.coverageLabel}
                  </span>
                  {row.coverageDescription && (
                    <span className="text-caption font-caption text-subtext-color mobile:text-caption mobile:font-caption">
                      {row.coverageDescription}
                    </span>
                  )}
                </div>
                {isSingleColumn ? (
                  <div className="flex grow shrink-0 basis-0 items-center justify-center">
                    <Badge variant="neutral">
                      {row.offerValue || row.currentValue || "—"}
                    </Badge>
                  </div>
                ) : (
                  <>
                    <div className="flex grow shrink-0 basis-0 items-center justify-center">
                      <Badge variant={row.currentVariant}>
                        {row.currentValue || "—"}
                      </Badge>
                    </div>
                    <div className="flex grow shrink-0 basis-0 items-center justify-center">
                      <Badge variant={row.offerVariant}>
                        {row.offerValue || "—"}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
