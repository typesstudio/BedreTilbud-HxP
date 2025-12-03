import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DebugReport {
  id: string;
  threadId: string;
  companyMessageId: string | null;
  aiMessageId: string | null;
  finalSentBody: string | null;
  classifierOutput: {
    category: string;
    intent: string;
    informationRequest: string | null;
  } | null;
  analysis: {
    quality_score: number;
    language_correct: boolean;
    tone_appropriate: boolean;
    answered_question: boolean;
    privacy_preserved: boolean;
    issues: string[];
    suggestions: string[];
    summary: string;
  } | null;
  replyPromptVersion: string | null;
  createdAt: string;
}

interface Metrics {
  totalReports: number;
  avgQualityScore: number;
  languageErrorRate: number;
  privacyIssueRate: number;
  commonIssues: { issue: string; count: number }[];
}

export default function AdminMessagingDebug() {
  const userId = localStorage.getItem("userId");
  const [selectedDays, setSelectedDays] = useState("7");
  const [selectedReport, setSelectedReport] = useState<DebugReport | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery<Metrics>({
    queryKey: ["/api/debug/ai-metrics", selectedDays],
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery<{ reports: DebugReport[] }>({
    queryKey: ["/api/debug/ai-reports"],
  });

  const reports = reportsData?.reports || [];

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) return "success";
    if (score >= 6) return "warning";
    return "error";
  };

  const formatPercent = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex h-full w-full flex-col bg-default-background px-4 md:px-12 py-6 md:py-12 overflow-auto">
        <div className="max-w-7xl w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-heading-1 font-heading-1 text-default-font mb-2">
              AI Messaging Debug Dashboard
            </h1>
            <p className="text-body text-subtext-color">
              Overvåg AI-genererede svar, kvalitetsscores og identificer forbedringsmuligheder
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="mb-6">
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger className="w-48" data-testid="select-time-range">
                <SelectValue placeholder="Vælg tidsperiode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Sidste 7 dage</SelectItem>
                <SelectItem value="14">Sidste 14 dage</SelectItem>
                <SelectItem value="30">Sidste 30 dage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color">
                  Antal rapporter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-default-font" data-testid="metric-total">
                  {metricsLoading ? "..." : metrics?.totalReports || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color">
                  Gennemsnitlig kvalitet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${getScoreColor(metrics?.avgQualityScore || 0)}`} data-testid="metric-quality">
                  {metricsLoading ? "..." : (metrics?.avgQualityScore || 0).toFixed(1)}/10
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color">
                  Sprogfejl rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(metrics?.languageErrorRate || 0) > 0.1 ? 'text-red-600' : 'text-green-600'}`} data-testid="metric-language">
                  {metricsLoading ? "..." : formatPercent(metrics?.languageErrorRate || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color">
                  Privatlivsproblemer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(metrics?.privacyIssueRate || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} data-testid="metric-privacy">
                  {metricsLoading ? "..." : formatPercent(metrics?.privacyIssueRate || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Common Issues */}
          {metrics?.commonIssues && metrics.commonIssues.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Hyppige problemer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics.commonIssues.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-neutral-50 rounded" data-testid={`issue-${idx}`}>
                      <span className="text-body text-default-font">{item.issue}</span>
                      <Badge variant="neutral">{item.count}x</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports List */}
          <Card>
            <CardHeader>
              <CardTitle>Seneste AI-svar rapporter</CardTitle>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-subtext-color">Indlæser rapporter...</p>
                </div>
              ) : reports.length === 0 ? (
                <p className="text-center py-8 text-subtext-color">
                  Ingen AI debug rapporter endnu
                </p>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedReport?.id === report.id ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                      onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                      data-testid={`report-${report.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getScoreBadge(report.analysis?.quality_score || 0) as any}>
                            Score: {report.analysis?.quality_score || 'N/A'}/10
                          </Badge>
                          {report.classifierOutput && (
                            <Badge variant="neutral">
                              {report.classifierOutput.category}
                            </Badge>
                          )}
                          {report.analysis && !report.analysis.language_correct && (
                            <Badge variant="error">Sprogfejl</Badge>
                          )}
                          {report.analysis && !report.analysis.privacy_preserved && (
                            <Badge variant="error">Privatlivsproblem</Badge>
                          )}
                        </div>
                        <span className="text-caption text-subtext-color">
                          {format(new Date(report.createdAt), "d. MMM HH:mm", { locale: da })}
                        </span>
                      </div>

                      {selectedReport?.id === report.id && report.analysis && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          <div>
                            <h4 className="text-body-bold mb-2">Opsummering</h4>
                            <p className="text-body text-subtext-color">{report.analysis.summary}</p>
                          </div>

                          {report.analysis.issues.length > 0 && (
                            <div>
                              <h4 className="text-body-bold mb-2 text-red-600">Problemer</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {report.analysis.issues.map((issue, idx) => (
                                  <li key={idx} className="text-body text-subtext-color">{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {report.analysis.suggestions.length > 0 && (
                            <div>
                              <h4 className="text-body-bold mb-2 text-brand-600">Forslag</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {report.analysis.suggestions.map((suggestion, idx) => (
                                  <li key={idx} className="text-body text-subtext-color">{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div>
                            <h4 className="text-body-bold mb-2">AI-svar</h4>
                            <div className="bg-neutral-100 p-3 rounded text-sm max-h-40 overflow-auto">
                              <pre className="whitespace-pre-wrap">{report.finalSentBody}</pre>
                            </div>
                          </div>

                          <div className="flex gap-4 text-caption text-subtext-color">
                            <span>Thread: {report.threadId}</span>
                            <span>Prompt version: {report.replyPromptVersion || 'N/A'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
