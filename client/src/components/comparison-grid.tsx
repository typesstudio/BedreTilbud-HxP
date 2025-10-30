import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText } from "lucide-react";
import { memo, useMemo } from "react";

interface ComparisonGridProps {
  currentDocument: any;
  offerDocument: any;
  comparisonData: any;
}

function ComparisonGrid({ currentDocument, offerDocument, comparisonData }: ComparisonGridProps) {
  const currentData = useMemo(() => currentDocument?.ocrData, [currentDocument]);
  const offerData = useMemo(() => offerDocument?.ocrData, [offerDocument]);
  const coverageComparison = useMemo(() => comparisonData?.coverageComparison || [], [comparisonData]);

  const formatCurrency = useMemo(() => {
    return (amount: number) => {
      return new Intl.NumberFormat('da-DK', {
        style: 'currency',
        currency: 'DKK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };
  }, []);

  return (
    <div className="comparison-grid mb-8">
      {/* Current Insurance */}
      <Card className="shadow-card border-2 border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Nuværende forsikring</h3>
              <p className="text-sm text-muted-foreground">Dit aktuelle tilbud</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="pb-4 border-b border-border">
              <p className="text-sm text-muted-foreground mb-1">Årlig pris</p>
              <p className="text-3xl font-bold text-foreground" data-testid="current-price">
                {currentData?.annualPremium ? formatCurrency(currentData.annualPremium) : 'Ikke tilgængelig'}
              </p>
            </div>

            <div className="pb-4 border-b border-border">
              <p className="text-sm text-muted-foreground mb-1">Selvrisiko</p>
              <p className="text-xl font-semibold text-foreground" data-testid="current-deductible">
                {currentData?.deductible ? formatCurrency(currentData.deductible) : 'Ikke tilgængelig'}
              </p>
            </div>

            <div className="pb-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground mb-3">Dækninger</p>
              <div className="space-y-2" data-testid="current-coverages">
                {currentData?.coverages?.map((coverage: any, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-foreground">
                      {coverage.name}: {coverage.amount ? formatCurrency(coverage.amount) : coverage.description || 'Inkluderet'}
                    </span>
                  </div>
                )) || (
                  <p className="text-muted-foreground">Ingen dækningsoplysninger tilgængelige</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Ekstra fordele</p>
              <div className="space-y-2" data-testid="current-benefits">
                {currentData?.benefits?.map((benefit: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                )) || (
                  <p className="text-muted-foreground">Ingen yderligere fordele tilgængelige</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Offer */}
      <Card className="shadow-card-lg border-2 border-primary relative">
        <div className="absolute -top-3 right-6 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
          Nyt tilbud
        </div>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {offerData?.companyName?.charAt(0) || 'A'}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                Nyt tilbud - {offerData?.companyName || 'Forsikringsselskab'}
              </h3>
              <p className="text-sm text-muted-foreground">Modtaget tilbud</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="pb-4 border-b border-border">
              <p className="text-sm text-muted-foreground mb-1">Årlig pris</p>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold text-primary" data-testid="offer-price">
                  {offerData?.annualPremium ? formatCurrency(offerData.annualPremium) : 'Ikke tilgængelig'}
                </p>
                {currentData?.annualPremium && offerData?.annualPremium && (
                  <Badge 
                    variant="secondary" 
                    className={`px-3 py-1 text-sm font-bold ${
                      offerData.annualPremium < currentData.annualPremium 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {offerData.annualPremium < currentData.annualPremium ? '-' : '+'}
                    {formatCurrency(Math.abs(offerData.annualPremium - currentData.annualPremium))}
                  </Badge>
                )}
              </div>
            </div>

            <div className="pb-4 border-b border-border">
              <p className="text-sm text-muted-foreground mb-1">Selvrisiko</p>
              <p className="text-xl font-semibold text-foreground" data-testid="offer-deductible">
                {offerData?.deductible ? formatCurrency(offerData.deductible) : 'Ikke tilgængelig'}
              </p>
              {currentData?.deductible && offerData?.deductible && currentData.deductible === offerData.deductible && (
                <p className="text-xs text-muted-foreground">Samme som nuværende</p>
              )}
            </div>

            <div className="pb-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground mb-3">Dækninger</p>
              <div className="space-y-2" data-testid="offer-coverages">
                {offerData?.coverages?.map((coverage: any, index: number) => {
                  // Check if this coverage is improved compared to current
                  const currentCoverage = currentData?.coverages?.find((c: any) => 
                    c.name?.toLowerCase().includes(coverage.name?.toLowerCase()) || 
                    coverage.name?.toLowerCase().includes(c.name?.toLowerCase())
                  );
                  const isImproved = coverageComparison.some((comp: any) => 
                    comp.category?.toLowerCase().includes(coverage.name?.toLowerCase()) && 
                    comp.status === 'improved'
                  );

                  return (
                    <div 
                      key={index} 
                      className={`flex items-center gap-2 ${isImproved ? 'bg-green-50 -mx-2 px-2 py-1 rounded' : ''}`}
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className={`text-foreground ${isImproved ? 'font-semibold' : ''}`}>
                        {coverage.name}: {coverage.amount ? formatCurrency(coverage.amount) : coverage.description || 'Inkluderet'}
                      </span>
                      {isImproved && (
                        <Badge variant="secondary" className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                          OPGRADERET
                        </Badge>
                      )}
                    </div>
                  );
                }) || (
                  <p className="text-muted-foreground">Ingen dækningsoplysninger tilgængelige</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Ekstra fordele</p>
              <div className="space-y-2" data-testid="offer-benefits">
                {offerData?.benefits?.map((benefit: string, index: number) => {
                  const isNew = !currentData?.benefits?.some((currentBenefit: string) =>
                    currentBenefit.toLowerCase().includes(benefit.toLowerCase()) ||
                    benefit.toLowerCase().includes(currentBenefit.toLowerCase())
                  );

                  return (
                    <div 
                      key={index} 
                      className={`flex items-center gap-2 ${isNew ? 'bg-green-50 -mx-2 px-2 py-1 rounded' : ''}`}
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className={`text-foreground ${isNew ? 'font-semibold' : ''}`}>
                        {benefit}
                      </span>
                      {isNew && (
                        <Badge variant="secondary" className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                          NY
                        </Badge>
                      )}
                    </div>
                  );
                }) || (
                  <p className="text-muted-foreground">Ingen yderligere fordele tilgængelige</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(ComparisonGrid);
