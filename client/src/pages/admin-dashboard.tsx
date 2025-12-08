import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatherMail, FeatherMessageCircle, FeatherActivity, FeatherAlertCircle, FeatherEdit3, FeatherRefreshCw, FeatherCheck, FeatherX } from "@subframe/core";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ThreadData {
  id: string;
  userId: string;
  companyId: string | null;
  subject: string | null;
  status: string;
  createdAt: string;
  company: { id: string; name: string; logoUrl: string | null } | null;
  user: { id: string; email: string; name: string | null } | null;
  emailCount: number;
  lastEmailAt: string | null;
}

interface DraftData {
  id: string;
  threadId: string;
  subject: string | null;
  body: string | null;
  createdAt: string;
  direction: string | null;
  authorType: string | null;
  metadata: { isInitialInquiry?: boolean; attachmentPaths?: string[]; companyEmail?: string } | null;
  attachments: { fileName: string; filePath: string }[] | null;
  thread: {
    id: string;
    userId: string;
    companyId: string | null;
    subject: string | null;
  };
  company: { id: string; name: string } | null;
  user: { id: string; email: string; name: string | null } | null;
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

function formatCopenhagenTime(dateStr: string, formatStr: string): string {
  const date = new Date(dateStr);
  const copenhagenOffset = 1;
  const isDST = (() => {
    const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== date.getTimezoneOffset();
  })();
  const offset = isDST ? 2 : copenhagenOffset;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const copenhagenDate = new Date(utc + (3600000 * offset));
  return format(copenhagenDate, formatStr, { locale: da });
}

export default function AdminDashboard() {
  const userId = localStorage.getItem("userId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'attention' | 'threads' | 'debug'>('attention');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string>("");
  const { toast } = useToast();

  const { data: threadsData, isLoading: threadsLoading } = useQuery<{ threads: ThreadData[]; count: number }>({
    queryKey: ["/api/admin/threads"],
  });

  const { data: draftsData, isLoading: draftsLoading, refetch: refetchDrafts } = useQuery<{ drafts: DraftData[]; count: number }>({
    queryKey: ["/api/admin/drafts"],
  });

  const { data: metrics } = useQuery<Metrics>({
    queryKey: ["/api/debug/ai-metrics"],
  });

  const { data: reportsData } = useQuery<{ reports: DebugReport[] }>({
    queryKey: ["/api/debug/ai-reports"],
  });

  const threads = threadsData?.threads || [];
  const drafts = draftsData?.drafts || [];
  const reports = reportsData?.reports || [];

  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/emails/check-inbox", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Inbox tjekket" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/threads"] });
    },
    onError: () => {
      toast({ title: "Kunne ikke tjekke inbox", variant: "destructive" });
    },
  });

  const runComparisonMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await apiRequest("POST", "/api/admin/run-comparison", { 
        userId: targetUserId, 
        forceRerun: true 
      });
      return response.json();
    },
    onSuccess: (data) => {
      const result = data.result;
      toast({ 
        title: `Sammenligning kørt: ${result.comparisonsCreated} oprettet, ${result.comparisonsFailed} fejlede` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/threads"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Kunne ikke køre sammenligning", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await apiRequest("POST", `/api/emails/draft/${draftId}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Email sendt!" });
      refetchDrafts();
      setEditingDraftId(null);
    },
    onError: () => {
      toast({ title: "Kunne ikke sende email", variant: "destructive" });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await apiRequest("POST", `/api/emails/draft/${draftId}/reject`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Kladde afvist" });
      refetchDrafts();
      setEditingDraftId(null);
    },
    onError: () => {
      toast({ title: "Kunne ikke afvise kladde", variant: "destructive" });
    },
  });

  const editDraftMutation = useMutation({
    mutationFn: async ({ draftId, body }: { draftId: string; body: string }) => {
      const response = await apiRequest("PATCH", `/api/emails/draft/${draftId}`, { body });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Kladde opdateret" });
      refetchDrafts();
    },
    onError: () => {
      toast({ title: "Kunne ikke opdatere kladde", variant: "destructive" });
    },
  });

  const startEditing = (draft: DraftData) => {
    setEditingDraftId(draft.id);
    setEditedBody(draft.body || "");
  };

  const saveAndApprove = async (draftId: string) => {
    if (editedBody !== drafts.find(d => d.id === draftId)?.body) {
      await editDraftMutation.mutateAsync({ draftId, body: editedBody });
    }
    approveDraftMutation.mutate(draftId);
  };

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

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex h-full w-full flex-col bg-default-background px-4 md:px-12 py-6 md:py-12 overflow-auto">
        <div className="max-w-7xl w-full mx-auto">
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-heading-1 font-heading-1 text-default-font mb-2">
                Admin Dashboard
              </h1>
              <p className="text-body text-subtext-color">
                Administrer alle email-tråde og overvåg AI-performance
              </p>
            </div>
            <Button
              variant="brand-primary"
              onClick={() => checkInboxMutation.mutate()}
              disabled={checkInboxMutation.isPending}
              data-testid="btn-check-inbox"
            >
              <FeatherRefreshCw className={`w-4 h-4 mr-2 ${checkInboxMutation.isPending ? 'animate-spin' : ''}`} />
              {checkInboxMutation.isPending ? "Tjekker..." : "Tjek inbox nu"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className={drafts.length > 0 ? "border-warning-500 bg-warning-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-subtext-color flex items-center gap-2">
                  <FeatherEdit3 className="w-4 h-4" />
                  Afventer godkendelse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${drafts.length > 0 ? 'text-warning-700' : 'text-default-font'}`} data-testid="stat-drafts">
                  {draftsLoading ? "..." : drafts.length}
                </p>
              </CardContent>
            </Card>

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
              variant={activeTab === 'attention' ? 'brand-primary' : 'neutral-secondary'}
              onClick={() => setActiveTab('attention')}
              data-testid="tab-attention"
            >
              Kræver opmærksomhed {drafts.length > 0 && `(${drafts.length})`}
            </Button>
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

          {activeTab === 'attention' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FeatherEdit3 className="w-5 h-5 text-warning-600" />
                  Kladder der afventer godkendelse
                </CardTitle>
              </CardHeader>
              <CardContent>
                {draftsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-8">
                    <FeatherMessageCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="text-subtext-color">Ingen kladder afventer godkendelse</p>
                    <p className="text-caption text-neutral-400 mt-1">Alt er opdateret!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {drafts.map((draft) => (
                      <div 
                        key={draft.id} 
                        className="border border-warning-200 bg-warning-50 rounded-lg p-4"
                        data-testid={`draft-card-${draft.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              draft.metadata?.isInitialInquiry 
                                ? 'bg-blue-200' 
                                : 'bg-warning-200'
                            }`}>
                              {draft.metadata?.isInitialInquiry 
                                ? <FeatherMail className="w-5 h-5 text-blue-700" />
                                : <FeatherEdit3 className="w-5 h-5 text-warning-700" />
                              }
                            </div>
                            <div>
                              <p className="text-body-bold font-body-bold text-default-font">
                                {draft.company?.name || 'Ukendt selskab'}
                              </p>
                              <p className="text-caption text-subtext-color">
                                Bruger: {draft.user?.name || draft.user?.email || 'Ukendt'}
                              </p>
                              {draft.metadata?.isInitialInquiry && draft.attachments && draft.attachments.length > 0 && (
                                <p className="text-caption text-blue-600 mt-1">
                                  📎 {draft.attachments.length} vedhæftning{draft.attachments.length > 1 ? 'er' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {draft.metadata?.isInitialInquiry ? (
                              <Badge variant="brand">Første henvendelse</Badge>
                            ) : (
                              <Badge variant="warning">AI-svar afventer</Badge>
                            )}
                            <p className="text-caption text-subtext-color mt-1">
                              {formatCopenhagenTime(draft.createdAt, "d. MMM HH:mm")}
                            </p>
                          </div>
                        </div>
                        
                        {editingDraftId === draft.id ? (
                          <div className="mt-3">
                            <p className="text-caption text-subtext-color mb-2">Rediger kladde:</p>
                            <textarea
                              className="w-full h-48 p-3 border border-neutral-border rounded-md text-body text-default-font bg-white resize-y"
                              value={editedBody}
                              onChange={(e) => setEditedBody(e.target.value)}
                              data-testid={`textarea-draft-${draft.id}`}
                            />
                            <div className="mt-3 flex gap-2 justify-end">
                              <Button
                                size="small"
                                variant="neutral-secondary"
                                onClick={() => setEditingDraftId(null)}
                                data-testid={`btn-cancel-edit-${draft.id}`}
                              >
                                Annuller
                              </Button>
                              <Button
                                size="small"
                                variant="destructive-secondary"
                                onClick={() => rejectDraftMutation.mutate(draft.id)}
                                disabled={rejectDraftMutation.isPending}
                                data-testid={`btn-reject-draft-${draft.id}`}
                              >
                                <FeatherX className="w-4 h-4 mr-1" />
                                Afvis
                              </Button>
                              <Button
                                size="small"
                                variant="brand-primary"
                                onClick={() => saveAndApprove(draft.id)}
                                disabled={approveDraftMutation.isPending || editDraftMutation.isPending}
                                data-testid={`btn-approve-draft-${draft.id}`}
                              >
                                <FeatherCheck className="w-4 h-4 mr-1" />
                                {approveDraftMutation.isPending ? "Sender..." : "Godkend og send"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-3 bg-white rounded p-3 border border-warning-100">
                              <p className="text-caption text-subtext-color mb-1">Kladde-indhold:</p>
                              <p className="text-body text-default-font whitespace-pre-wrap">
                                {draft.body || 'Ingen indhold'}
                              </p>
                            </div>
                            <div className="mt-3 flex gap-2 justify-end">
                              <Button
                                size="small"
                                variant="neutral-secondary"
                                onClick={() => setLocation(`/emails/${draft.threadId}`)}
                                data-testid={`btn-view-thread-${draft.id}`}
                              >
                                Se tråd
                              </Button>
                              <Button
                                size="small"
                                variant="brand-primary"
                                onClick={() => startEditing(draft)}
                                data-testid={`btn-edit-draft-${draft.id}`}
                              >
                                <FeatherEdit3 className="w-4 h-4 mr-1" />
                                Rediger og godkend
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                              <span className="text-body font-body text-default-font">
                                {thread.emailCount}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-caption text-subtext-color">
                                {thread.lastEmailAt 
                                  ? formatCopenhagenTime(thread.lastEmailAt, "d. MMM HH:mm")
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex gap-2">
                                <Button
                                  size="small"
                                  variant="neutral-secondary"
                                  onClick={() => setLocation(`/emails/${thread.id}`)}
                                  data-testid={`btn-view-thread-${thread.id}`}
                                >
                                  Se tråd
                                </Button>
                                {thread.status === 'received' && thread.userId && (
                                  <Button
                                    size="small"
                                    variant="brand-secondary"
                                    onClick={() => runComparisonMutation.mutate(thread.userId)}
                                    disabled={runComparisonMutation.isPending}
                                    data-testid={`btn-run-comparison-${thread.id}`}
                                  >
                                    {runComparisonMutation.isPending ? "Kører..." : "Kør sammenligning"}
                                  </Button>
                                )}
                              </div>
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
                            {formatCopenhagenTime(report.createdAt, "d. MMM HH:mm")}
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
