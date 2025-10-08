import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, AlertTriangle, Lightbulb, Mail } from "lucide-react";
import ComparisonGrid from "@/components/comparison-grid";

export default function Comparison() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["/api/comparisons", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Indlæser sammenligning...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Sammenligning ikke fundet</h2>
          <Button onClick={() => setLocation("/offers")}>
            Tilbage til oversigt
          </Button>
        </div>
      </div>
    );
  }

  const comparisonData = comparison.comparisonData || {};
  const verdict = comparisonData.verdict || "consider";
  const pros = comparisonData.pros || [];
  const cons = comparisonData.cons || [];
  const qualityScore = comparisonData.qualityScore || 7;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">BedreTilbud</h1>
                <p className="text-sm text-muted-foreground">Find bedre forsikringer</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <Button 
                variant="ghost"
                onClick={() => setLocation("/offers")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
                data-testid="button-back-to-offers"
              >
                <ArrowLeft className="w-5 h-5" />
                Tilbage til oversigt
              </Button>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                Sammenligning: {comparison.company?.name}
              </h2>
              <p className="text-lg text-muted-foreground">
                Se hvordan det nye tilbud matcher med din nuværende forsikring
              </p>
            </div>

            {/* AI Recommendation */}
            <Card className={`mb-8 ${
              verdict === 'recommended' 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200'
                : verdict === 'not_recommended'
                ? 'bg-gradient-to-r from-red-50 to-red-50 border-2 border-red-200'
                : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200'
            }`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    verdict === 'recommended'
                      ? 'bg-green-600'
                      : verdict === 'not_recommended'
                      ? 'bg-red-600'
                      : 'bg-yellow-600'
                  }`}>
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      AI Anbefaling: {
                        verdict === 'recommended'
                          ? 'Dette er et godt tilbud!'
                          : verdict === 'not_recommended'
                          ? 'Vi anbefaler ikke dette tilbud'
                          : 'Overvej dette tilbud nøje'
                      }
                    </h3>
                    <p className="text-foreground mb-4" data-testid="ai-recommendation">
                      {comparison.aiRecommendation || 'Ingen anbefaling tilgængelig.'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <div className="bg-white px-4 py-2 rounded-lg">
                        <span className="text-sm text-muted-foreground">Besparelse:</span>
                        <span className={`ml-2 font-bold ${
                          comparison.savings > 0 ? 'text-green-600' : 'text-red-600'
                        }`} data-testid="savings-amount">
                          {comparison.savings > 0 ? '+' : ''}{comparison.savings} kr./år
                        </span>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-lg">
                        <span className="text-sm text-muted-foreground">Kvalitetsscore:</span>
                        <span className="ml-2 font-bold text-foreground" data-testid="quality-score">
                          {qualityScore}/10
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparison Grid */}
            <ComparisonGrid
              currentDocument={comparison.currentDocument}
              offerDocument={comparison.offerDocument}
              comparisonData={comparisonData}
            />

            {/* Pros and Cons */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-green-50 border-2 border-green-200">
                <CardContent className="p-6">
                  <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Fordele
                  </h4>
                  <ul className="space-y-2" data-testid="pros-list">
                    {pros.length > 0 ? pros.map((pro: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span className="text-foreground">{pro}</span>
                      </li>
                    )) : (
                      <li className="text-muted-foreground">Ingen specifikke fordele identificeret</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 border-2 border-orange-200">
                <CardContent className="p-6">
                  <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Overvejelser
                  </h4>
                  <ul className="space-y-2" data-testid="cons-list">
                    {cons.length > 0 ? cons.map((con: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span className="text-foreground">{con}</span>
                      </li>
                    )) : (
                      <li className="text-muted-foreground">Ingen specifikke ulemper identificeret</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                className="flex-1 text-lg px-8 py-4"
                data-testid="button-accept-offer"
              >
                <CheckCircle className="mr-2 w-5 h-5" />
                Jeg vil skifte til {comparison.company?.name}
              </Button>
              <Button 
                variant="secondary"
                className="flex-1 text-lg px-8 py-4"
                data-testid="button-contact-me"
              >
                <Mail className="mr-2 w-5 h-5" />
                Kontakt mig for mere info
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
