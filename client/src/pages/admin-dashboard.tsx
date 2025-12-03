import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatherMail, FeatherMessageCircle, FeatherActivity, FeatherAlertCircle } from "@subframe/core";

interface ThreadData {
  id: string;
  userId: string;
  companyId: string | null;
  subject: string | null;
  status: string;
  createdAt: string;
  aiMode: string | null;
  company: { id: string; name: string; logoUrl: string | null } | null;
  user: { id: string; email: string; name: string | null } | null;
  emailCount: number;
  lastEmailAt: string | null;
}

interface DebugReport {
  id: string;
  threadId: string;
  analysis: {
    quality_score: number;
    language_correct: boolean;
    privacy_preserved: boolean;
    issues: string[];
  } | null;
  createdAt: string;
}

interface Metrics {
  totalReports: number;
  avgQualityScore: number;
  languageErrorRate: number;
  privacyIssueRate: number;
}

export default function AdminDashboard() {
  const userId = localStorage.getItem("userId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'threads' | 'debug'>('threads');

  const { data: threadsData, isLoading: threadsLoading } = useQuery<{ threads: ThreadData[]; count: number }>({
    queryKey: ["/api/admin/threads"],
  });

  const { data: metrics } = useQuery<Metrics>({
    queryKey: ["/api/debug/ai-metrics"],
  });

  const { data: reportsData } = useQuery<{ reports: DebugReport[] }>({
    queryKey: ["/api/debug/ai-reports"],
  });

  const threads = threadsData?.threads || [];
  const reports = reportsData?.reports || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge variant="success">Modtaget svar</Badge>;
      case 'sent':
        return <Badge variant="neutral">Sendt</Badge>;
      case 'pending':
        return <Badge variant="warning">Afventer</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getAiModeBadge = (aiMode: string | null) => {
    if (aiMode === 'auto') {
      return <Badge variant="success">Auto AI</Badge>;
    }
    return <Badge variant="neutral">Manuel</Badge>;
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex h-full w-full flex-col bg-default-background px-4 md:px-12 py-6 md:py-12 overflow-auto">
        <div className="max-w-7xl w-full mx-auto">
          <div className="mb-8">
            <h1 className="text-heading-1 font-heading-1 text-default-font mb-2">
              Admin Dashboard
            </h1>
            <p className="text-body text-subtext-color">
              Administrer alle email-tråde og overvåg AI-performance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color flex items-center gap-2">
                  <FeatherMail className="w-4 h-4" />
                  Aktive tråde
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-default-font" data-testid="stat-threads">
                  {threadsLoading ? "..." : threads.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color flex items-center gap-2">
                  <FeatherMessageCircle className="w-4 h-4" />
                  AI Rapporter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-default-font" data-testid="stat-reports">
                  {metrics?.totalReports || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color flex items-center gap-2">
                  <FeatherActivity className="w-4 h-4" />
                  Kvalitetsscore
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(metrics?.avgQualityScore || 0) >= 7 ? 'text-green-600' : 'text-amber-600'}`} data-testid="stat-quality">
                  {metrics?.avgQualityScore?.toFixed(1) || "0.0"}/10
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color flex items-center gap-2">
                  <FeatherAlertCircle className="w-4 h-4" />
                  Fejlrate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(metrics?.privacyIssueRate || 0) < 0.1 ? 'text-green-600' : 'text-red-600'}`} data-testid="stat-errors">
                  {((metrics?.privacyIssueRate || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === 'threads' ? 'brand-primary' : 'neutral-secondary'}
              onClick={() => setActiveTab('threads')}
              data-testid="tab-threads"
            >
              Alle tråde
            </Button>
            <Button
              variant={activeTab === 'debug' ? 'brand-primary' : 'neutral-secondary'}
              onClick={() => setActiveTab('debug')}
              data-testid="tab-debug"
            >
              AI Debug
            </Button>
            <Button
              variant="neutral-secondary"
              onClick={() => setLocation('/admin/messaging-debug')}
              data-testid="btn-full-debug"
            >
              Fuld debug oversigt →
            </Button>
          </div>

          {activeTab === 'threads' && (
            <Card>
              <CardHeader>
                <CardTitle>Alle email-tråde</CardTitle>
              </CardHeader>
              <CardContent>
                {threadsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : threads.length === 0 ? (
                  <p className="text-subtext-color text-center py-8">Ingen tråde endnu</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-border">
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Bruger</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Selskab</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Status</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">AI Mode</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Beskeder</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Seneste</th>
                          <th className="text-left py-3 px-2 text-caption font-caption text-subtext-color">Handling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {threads.map((thread) => (
                          <tr key={thread.id} className="border-b border-neutral-border hover:bg-neutral-50">
                            <td className="py-3 px-2">
                              <div className="flex flex-col">
                                <span className="text-body-bold font-body-bold text-default-font truncate max-w-[150px]">
                                  {thread.user?.name || 'Ukendt'}
                                </span>
                                <span className="text-caption text-subtext-color truncate max-w-[150px]">
                                  {thread.user?.email || ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-body font-body text-default-font">
                                {thread.company?.name || 'Ukendt selskab'}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              {getStatusBadge(thread.status)}
                            </td>
                            <td className="py-3 px-2">
                              {getAiModeBadge(thread.aiMode)}
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-body font-body text-default-font">
                                {thread.emailCount}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-caption text-subtext-color">
                                {thread.lastEmailAt 
                                  ? format(new Date(thread.lastEmailAt), "d. MMM HH:mm", { locale: da })
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <Button
                                size="small"
                                variant="neutral-secondary"
                                onClick={() => setLocation(`/emails/${thread.id}`)}
                                data-testid={`btn-view-thread-${thread.id}`}
                              >
                                Se tråd
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'debug' && (
            <Card>
              <CardHeader>
                <CardTitle>Seneste AI debug rapporter</CardTitle>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-subtext-color text-center py-8">Ingen AI debug rapporter endnu</p>
                ) : (
                  <div className="space-y-4">
                    {reports.slice(0, 10).map((report) => (
                      <div key={report.id} className="border border-neutral-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-body-bold font-body-bold text-default-font">
                              Thread: {report.threadId.substring(0, 8)}...
                            </span>
                            {report.analysis && (
                              <Badge variant={report.analysis.quality_score >= 7 ? 'success' : report.analysis.quality_score >= 5 ? 'warning' : 'error'}>
                                Score: {report.analysis.quality_score}/10
                              </Badge>
                            )}
                          </div>
                          <span className="text-caption text-subtext-color">
                            {format(new Date(report.createdAt), "d. MMM HH:mm", { locale: da })}
                          </span>
                        </div>
                        {report.analysis?.issues && report.analysis.issues.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {report.analysis.issues.map((issue, idx) => (
                              <Badge key={idx} variant="error">{issue}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
