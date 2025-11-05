import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Badge, 
  Button, 
  IconWithBackground, 
  Table
} from "@/ui";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MobileComparisonCard } from "@/components/mobile-comparison-card";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { 
  FeatherArrowRight,
  FeatherPiggyBank,
  FeatherCheck,
  FeatherAlertCircle,
  FeatherDollarSign,
  FeatherHelpCircle,
  FeatherShield,
  FeatherHome,
  FeatherClock,
  FeatherTrendingUp,
  FeatherInfo,
  FeatherFileText
} from "@subframe/core";
import FileUpload from "@/components/file-upload";
import React from "react";

const iconMap: { [key: string]: any } = {
  "trending-up": FeatherTrendingUp,
  "shield": FeatherShield,
  "home": FeatherHome,
  "clock": FeatherClock,
  "piggy-bank": FeatherPiggyBank,
  "dollar-sign": FeatherDollarSign,
  "help-circle": FeatherHelpCircle,
  "alert-circle": FeatherAlertCircle,
  "check": FeatherCheck,
  "info": FeatherInfo
};

export default function InsuranceCheck() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const [healthCheckResult, setHealthCheckResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!userId) {
    setLocation("/onboarding");
    return null;
  }

  // Fetch user's current insurance documents
  const { data: userDocumentsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/documents/user", userId, "current"],
    queryFn: async () => {
      const response = await fetch(`/api/documents/user/${userId}?documentType=current`, {
        headers: {
          "X-User-ID": userId,
        },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });
  const userDocuments = userDocumentsResponse?.data || [];

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setIsUploading(true);
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("userId", userId!);
      formData.append("documentType", "current");

      const response = await apiRequest("POST", "/api/documents/upload", formData);
      return response.json();
    },
    onSuccess: (data) => {
      setIsUploading(false);
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        setUploadedDocument(doc);
        // Automatically analyze after upload
        analyzeMutation.mutate(doc.id);
      }
    },
    onError: () => {
      setIsUploading(false);
      toast({
        title: "Fejl",
        description: "Kunne ikke uploade dokument",
        variant: "destructive",
      });
    },
  });

  // Analyze document mutation
  const analyzeMutation = useMutation({
    mutationFn: async (documentId: string) => {
      setIsAnalyzing(true);
      const response = await apiRequest("POST", "/api/insurance-check/analyze", {
        documentId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsAnalyzing(false);
      setHealthCheckResult(data.healthCheck);
      toast({
        title: "Analyse gennemført",
        description: "Din forsikring er blevet analyseret",
      });
    },
    onError: (error: any) => {
      setIsAnalyzing(false);
      console.error("Analysis error:", error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke analysere forsikring",
        variant: "destructive",
      });
    },
  });

  const handleFilesUploaded = (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length > 0) {
      uploadMutation.mutate(fileArray);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success-600";
    if (score >= 6) return "text-warning-600";
    return "text-error-600";
  };

  const getScoreVariant = (score: number): "success" | "warning" | "error" => {
    if (score >= 8) return "success";
    if (score >= 6) return "warning";
    return "error";
  };

  // If no results yet, show upload section
  if (!healthCheckResult) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex w-full flex-col items-center justify-center bg-default-background px-6 py-12">
          <div className="flex w-full max-w-[600px] flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <IconWithBackground
                variant="brand"
                size="x-large"
                icon={<FeatherShield />}
              />
              <div className="flex flex-col items-center gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  Tjek din forsikring
                </span>
                <span className="text-body font-body text-subtext-color max-w-[480px]">
                  Upload din nuværende forsikring og få en grundig analyse af hvad der er godt, hvad der mangler, og hvor du kan spare penge
                </span>
              </div>
            </div>

            {/* Show existing documents */}
            {userDocuments.length > 0 && (
              <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Dine uploadede forsikringer
                </span>
                <div className="flex w-full flex-col items-start gap-3">
                  {userDocuments.map((doc: any) => (
                    <div key={doc.id} className="flex w-full items-center justify-between gap-4 rounded-md bg-neutral-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <IconWithBackground
                          variant="neutral"
                          size="small"
                          icon={<FeatherFileText />}
                        />
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {doc.fileName}
                          </span>
                          <span className="text-caption font-caption text-subtext-color">
                            Uploadet {new Date(doc.createdAt).toLocaleDateString('da-DK')}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="small"
                        onClick={() => {
                          setUploadedDocument(doc);
                          analyzeMutation.mutate(doc.id);
                        }}
                        disabled={isAnalyzing}
                        data-testid={`button-analyze-${doc.id}`}
                      >
                        {isAnalyzing ? "Analyserer..." : "Analyser nu"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex w-full flex-col items-start gap-6 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
              <span className="text-body-bold font-body-bold text-default-font">
                Upload ny forsikring
              </span>
              <FileUpload
                onFilesUploaded={handleFilesUploaded}
                uploadedFiles={[]}
                isUploading={isUploading || isAnalyzing}
              />

              {(isUploading || isAnalyzing) && (
                <div className="flex w-full flex-col items-center gap-3 py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="text-body font-body text-subtext-color">
                    {isUploading ? "Uploader dokument..." : "Analyserer din forsikring..."}
                  </span>
                </div>
              )}

              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-caption-bold font-caption-bold text-default-font">
                  Sådan virker det:
                </span>
                <ul className="flex flex-col gap-2 pl-4">
                  <li className="text-body font-body text-subtext-color">
                    • Upload din forsikringspolice (PDF format)
                  </li>
                  <li className="text-body font-body text-subtext-color">
                    • AI analyserer dækning, priser og mangler
                  </li>
                  <li className="text-body font-body text-subtext-color">
                    • Se hvor du kan forbedre og spare penge
                  </li>
                  <li className="text-body font-body text-subtext-color">
                    • Få konkurrerende tilbud hvis du vil
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  // Results view
  const { 
    overallScore, 
    scoreExplanation, 
    potentialSavings,
    strengths,
    weaknesses,
    coverageGaps,
    marketComparison,
    recommendations
  } = healthCheckResult;

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex w-full flex-col items-center justify-center bg-default-background px-6 py-6">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-6">
          {/* Header */}
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Forsikrings Sundhedstjek
            </span>
            <span className="text-body font-body text-subtext-color">
              Analyse af {uploadedDocument?.fileName || "din forsikring"}
            </span>
          </div>

          {/* Health Score Banner */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <IconWithBackground
                  variant={getScoreVariant(overallScore)}
                  size="x-large"
                  icon={<FeatherShield />}
                />
                <div className="flex flex-col items-start gap-1">
                  <span className="text-body font-body text-subtext-color">
                    Din forsikringsscore
                  </span>
                  <span className={`text-heading-1 font-heading-1 ${getScoreColor(overallScore)}`}>
                    {overallScore}/10
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="warning" icon={<FeatherPiggyBank />}>
                  Potentiel besparelse
                </Badge>
                <span className="text-heading-2 font-heading-2 text-warning-600">
                  ~{formatCurrency(potentialSavings.realistic)}/år
                </span>
              </div>
            </div>
            <div className="w-full h-px bg-neutral-border"></div>
            <span className="text-body font-body text-default-font">
              {scoreExplanation}
            </span>
          </div>

          {/* Potential Savings Breakdown */}
          {potentialSavings && (
            <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-4">
              <span className="text-body-bold font-body-bold text-default-font">
                Besparelsespotentiale
              </span>
              <div className="flex w-full items-center gap-4">
                <div className="flex grow shrink-0 basis-0 flex-col items-center gap-1 rounded-md bg-default-background px-4 py-3">
                  <span className="text-caption font-caption text-subtext-color">Konservativ</span>
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {formatCurrency(potentialSavings.conservative)}
                  </span>
                </div>
                <div className="flex grow shrink-0 basis-0 flex-col items-center gap-1 rounded-md bg-warning-50 px-4 py-3 border border-warning-200">
                  <span className="text-caption font-caption text-warning-700">Realistisk</span>
                  <span className="text-heading-3 font-heading-3 text-warning-700">
                    {formatCurrency(potentialSavings.realistic)}
                  </span>
                </div>
                <div className="flex grow shrink-0 basis-0 flex-col items-center gap-1 rounded-md bg-default-background px-4 py-3">
                  <span className="text-caption font-caption text-subtext-color">Optimistisk</span>
                  <span className="text-heading-3 font-heading-3 text-default-font">
                    {formatCurrency(potentialSavings.optimistic)}
                  </span>
                </div>
              </div>
              <span className="text-caption font-caption text-subtext-color">
                {potentialSavings.explanation}
              </span>
            </div>
          )}

          {/* Strengths (What's Good) */}
          {strengths && strengths.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <span className="text-heading-3 font-heading-3 text-default-font">
                ✓ Hvad er godt
              </span>
              <div className="flex w-full flex-wrap items-start gap-4">
                {strengths.map((strength: any, index: number) => {
                  const IconComponent = iconMap[strength.icon] || FeatherCheck;
                  return (
                    <div key={index} className="flex min-w-[280px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid border-success-200 bg-success-50 px-4 py-4">
                      <IconWithBackground
                        variant="success"
                        size="medium"
                        icon={<IconComponent />}
                        square={true}
                      />
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {strength.title}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {strength.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weaknesses (What Could Be Better) */}
          {weaknesses && weaknesses.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <span className="text-heading-3 font-heading-3 text-default-font">
                ⚠️ Hvad kan forbedres
              </span>
              <div className="flex w-full flex-wrap items-start gap-4">
                {weaknesses.map((weakness: any, index: number) => {
                  const IconComponent = iconMap[weakness.icon] || FeatherAlertCircle;
                  const variantColor = weakness.severity === 'critical' ? 'error' : 'warning';
                  return (
                    <div key={index} className={`flex min-w-[280px] grow shrink-0 basis-0 flex-col items-start gap-3 rounded-md border border-solid ${weakness.severity === 'critical' ? 'border-error-200 bg-error-50' : 'border-warning-200 bg-warning-50'} px-4 py-4`}>
                      <IconWithBackground
                        variant={variantColor as any}
                        size="medium"
                        icon={<IconComponent />}
                        square={true}
                      />
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-body-bold font-body-bold text-default-font">
                            {weakness.title}
                          </span>
                          <Badge variant={variantColor as any}>
                            {weakness.severity === 'critical' ? 'Kritisk' : 'Vigtig'}
                          </Badge>
                        </div>
                        <span className="text-caption font-caption text-subtext-color">
                          {weakness.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Market Comparison Table */}
          {marketComparison && marketComparison.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Sammenligning med markedet
              </span>
              {/* Desktop Table View */}
              <div className="desktop-only w-full">
                <Table
                  header={
                    <Table.HeaderRow>
                      <Table.HeaderCell>Kategori</Table.HeaderCell>
                      <Table.HeaderCell>Dit tilbud</Table.HeaderCell>
                      <Table.HeaderCell>Markedsgennemsnit</Table.HeaderCell>
                      <Table.HeaderCell>Forskel</Table.HeaderCell>
                    </Table.HeaderRow>
                  }
                >
                  {marketComparison.map((item: any, index: number) => (
                    <Table.Row key={index}>
                      <Table.Cell>
                        <span className="text-body-bold font-body-bold text-default-font">
                          {item.category}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font">
                          {item.current}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-body font-body text-default-font">
                          {item.marketAverage}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant={item.status === 'better' ? 'success' : item.status === 'worse' ? 'error' : 'neutral'}>
                          {item.difference}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table>
              </div>

              {/* Mobile Card View */}
              <MobileComparisonCard 
                rows={marketComparison.map((item: any) => ({
                  feature: item.category,
                  current: item.current,
                  offer: item.marketAverage,
                  difference: item.difference,
                  status: item.status,
                  isCategory: false
                }))}
              />
            </div>
          )}

          {/* Coverage Gaps (Categorized) */}
          {coverageGaps && coverageGaps.categories && coverageGaps.categories.some((cat: any) => cat.items.length > 0) && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Detaljeret Analyse
                </span>
                <span className="text-body font-body text-subtext-color">
                  Områder der kræver opmærksomhed
                </span>
              </div>
              <div className="flex w-full flex-col items-start gap-4">
                {coverageGaps.categories.map((category: any, catIndex: number) => {
                  if (category.items.length === 0) return null;
                  
                  return (
                    <div key={catIndex} className="flex w-full flex-col items-start gap-3">
                      <div className="flex w-full items-center gap-2">
                        <IconWithBackground
                          variant="neutral"
                          size="small"
                          icon={iconMap[category.icon] ? React.createElement(iconMap[category.icon]) : <FeatherHelpCircle />}
                        />
                        <span className="text-body-bold font-body-bold text-default-font">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex w-full flex-col items-start gap-2 pl-8">
                        {category.items.map((item: any, itemIndex: number) => (
                          <div key={itemIndex} className="flex w-full items-start gap-3 rounded-md bg-neutral-50 px-4 py-3">
                            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-body-bold font-body-bold text-default-font">
                                  {item.title}
                                </span>
                                {item.severity && (
                                  <Badge variant={item.severity === 'critical' ? 'error' : item.severity === 'important' ? 'warning' : 'neutral'}>
                                    {item.severity === 'critical' ? 'Kritisk' : item.severity === 'important' ? 'Vigtig' : 'Info'}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-caption font-caption text-subtext-color">
                                {item.description}
                              </span>
                            </div>
                            {(item.estimatedCost || item.potentialSaving) && (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-caption font-caption text-subtext-color">
                                  {item.estimatedCost ? 'Estimeret pris' : 'Potentiel besparelse'}
                                </span>
                                <span className={`text-body-bold font-body-bold ${item.potentialSaving ? 'text-success-600' : 'text-default-font'}`}>
                                  {formatCurrency(item.estimatedCost || item.potentialSaving)}/år
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-brand-200 bg-brand-50 px-6 py-6">
              <span className="text-heading-3 font-heading-3 text-default-font">
                Anbefalede næste skridt
              </span>
              <div className="flex w-full flex-col items-start gap-3">
                {recommendations.sort((a: any, b: any) => a.priority - b.priority).map((rec: any, index: number) => (
                  <div key={index} className="flex w-full items-start gap-3 rounded-md bg-default-background px-4 py-4">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500">
                      <span className="text-body-bold font-body-bold text-white">
                        {rec.priority}
                      </span>
                    </div>
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {rec.title}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {rec.description}
                      </span>
                      {rec.estimatedImpact && (
                        <Badge variant="success" icon={<FeatherPiggyBank />}>
                          {rec.estimatedImpact}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call to Action */}
          <div className="flex w-full flex-col items-center gap-4 border-t border-solid border-neutral-border pt-6">
            <Button
              className="h-10 w-full flex-none"
              size="large"
              onClick={() => setLocation("/onboarding")}
              data-testid="button-find-better-offers"
            >
              Find bedre tilbud nu
            </Button>
            <span className="text-body font-body text-subtext-color text-center">
              Vi sender din police til 3-5 forsikringsselskaber og finder det bedste tilbud
            </span>
            <Button
              variant="neutral-tertiary"
              onClick={() => {
                setHealthCheckResult(null);
                setUploadedDocument(null);
              }}
              data-testid="button-check-another"
            >
              Tjek en anden forsikring
            </Button>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
