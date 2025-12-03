import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { Loader } from "@/ui/components/Loader";
import { FeatherBarChart2, FeatherCheck, FeatherX, FeatherEdit2 } from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EmailCorrespondence() {
  const { threadId } = useParams();
  const [location, setLocation] = useLocation();
  const userId = localStorage.getItem("userId");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState("");

  const { data: threadData, isLoading } = useQuery({
    queryKey: ["/api/emails/thread", threadId],
    enabled: !!threadId,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const approveDraft = useMutation({
    mutationFn: async (draftId: string) => {
      return apiRequest(`/api/emails/draft/${draftId}/approve`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/thread", threadId] });
      toast({ title: "Besked godkendt og sendt" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const rejectDraft = useMutation({
    mutationFn: async (draftId: string) => {
      return apiRequest(`/api/emails/draft/${draftId}/reject`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/thread", threadId] });
      toast({ title: "Draft afvist" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  const editDraft = useMutation({
    mutationFn: async ({ draftId, body }: { draftId: string; body: string }) => {
      return apiRequest(`/api/emails/draft/${draftId}`, { 
        method: "PATCH",
        body: JSON.stringify({ body }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails/thread", threadId] });
      setEditingDraftId(null);
      toast({ title: "Draft opdateret" });
    },
    onError: (error: any) => {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-subtext-color">Indlæser beskedtråd...</p>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  if (!threadData) {
    return (
      <AppLayoutWithNav userId={userId!}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Tråd ikke fundet</h2>
            <Button onClick={() => setLocation("/offers")}>
              Tilbage til oversigt
            </Button>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  const { thread, company, emails = [], comparisonId } = (threadData as any) || {};
  const companyName = company?.name || 'Ukendt selskab';

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "HH:mm", { locale: da });
    } catch {
      return '';
    }
  };

  const isDraft = (email: any) => email.status === 'draft';
  const isRejected = (email: any) => email.status === 'rejected';

  const getMessageBgClass = (email: any) => {
    if (isDraft(email)) {
      return 'bg-amber-50 border-2 border-dashed border-amber-300';
    }
    if (isRejected(email)) {
      return 'bg-neutral-100 opacity-60';
    }
    if (email.direction === 'auto' || email.direction === 'outbound') {
      return 'bg-neutral-50';
    }
    return 'bg-brand-50';
  };

  const getAvatarContent = (email: any) => {
    if (isDraft(email)) {
      return (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100">
          <span className="text-caption-bold font-caption-bold text-amber-700">
            AI
          </span>
        </div>
      );
    }
    if (email.direction === 'auto' || email.direction === 'outbound') {
      return (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100">
          <span className="text-caption-bold font-caption-bold text-brand-700">
            AI
          </span>
        </div>
      );
    }
    return (
      <img
        className="h-8 w-8 flex-none rounded-full object-cover bg-neutral-200"
        src={company?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=e5e5e5&color=737373`}
        alt={companyName}
      />
    );
  };

  const getSenderName = (email: any) => {
    if (isDraft(email)) {
      return 'BedreTilbud AI (Kladde)';
    }
    if (email.direction === 'auto' || email.direction === 'outbound') {
      return email.authorType === 'user' ? 'Dig' : 'BedreTilbud AI';
    }
    return companyName;
  };

  const startEditing = (email: any) => {
    setEditingDraftId(email.id);
    setEditedBody(email.body || '');
  };

  const cancelEditing = () => {
    setEditingDraftId(null);
    setEditedBody('');
  };

  const saveEdit = (draftId: string) => {
    editDraft.mutate({ draftId, body: editedBody });
  };

  const comparisonPath = comparisonId ? `/sammenligning/${comparisonId}` : "/offers";
  const visibleEmails = emails
    .filter((e: any) => e.status !== 'rejected')
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const hasPendingDrafts = emails.some((e: any) => isDraft(e));

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex h-full w-full items-center justify-center bg-default-background px-4 md:px-12 py-6 md:py-12">
        <div className="flex w-full max-w-[768px] flex-none flex-col items-center justify-center rounded-md bg-white" style={{ height: 'calc(100vh - 120px)' }}>
          {/* Header */}
          <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-4 md:px-6 py-4">
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
              <span className="text-heading-1 font-heading-1 text-default-font">
                Din samtale med {companyName}
              </span>
              <span className="text-body font-body text-subtext-color">
                Her kan du følge med i samtalen mellem {companyName} og dig
              </span>
            </div>
            <Button
              icon={<FeatherBarChart2 />}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                setLocation(comparisonPath);
              }}
              data-testid="button-view-offer"
            >
              Se tilbudet
            </Button>
          </div>

          {/* Messages */}
          <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-6 px-4 md:px-6 py-6 overflow-auto">
            {visibleEmails.length === 0 ? (
              <div className="flex w-full h-full items-center justify-center">
                <div className="text-center">
                  <span className="text-body font-body text-subtext-color">
                    Ingen beskeder endnu
                  </span>
                </div>
              </div>
            ) : (
              visibleEmails.map((email: any, index: number) => (
                <div key={email.id || index} className="flex w-full items-start gap-4" data-testid={`message-${index}`}>
                  {getAvatarContent(email)}
                  <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {getSenderName(email)}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {formatTime(email.sentAt || email.createdAt)}
                      </span>
                      {isDraft(email) && (
                        <Badge variant="warning" data-testid={`badge-draft-${email.id}`}>
                          Afventer godkendelse
                        </Badge>
                      )}
                    </div>
                    
                    {editingDraftId === email.id ? (
                      <div className="flex flex-col gap-2 w-full max-w-2xl">
                        <textarea
                          className="w-full min-h-[150px] p-3 border border-neutral-300 rounded-lg text-body font-body resize-y"
                          value={editedBody}
                          onChange={(e) => setEditedBody(e.target.value)}
                          data-testid={`textarea-edit-draft-${email.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="small"
                            onClick={() => saveEdit(email.id)}
                            disabled={editDraft.isPending}
                            data-testid={`button-save-edit-${email.id}`}
                          >
                            Gem ændringer
                          </Button>
                          <Button
                            size="small"
                            variant="neutral-secondary"
                            onClick={cancelEditing}
                            data-testid={`button-cancel-edit-${email.id}`}
                          >
                            Annuller
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`flex items-start rounded-lg ${getMessageBgClass(email)} px-4 py-3 max-w-2xl`}>
                          <span className="text-body font-body text-default-font whitespace-pre-wrap">
                            {email.body}
                          </span>
                        </div>
                        
                        {isDraft(email) && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="small"
                              icon={<FeatherCheck />}
                              onClick={() => approveDraft.mutate(email.id)}
                              disabled={approveDraft.isPending}
                              data-testid={`button-approve-draft-${email.id}`}
                            >
                              Godkend og send
                            </Button>
                            <Button
                              size="small"
                              variant="neutral-secondary"
                              icon={<FeatherEdit2 />}
                              onClick={() => startEditing(email)}
                              data-testid={`button-edit-draft-${email.id}`}
                            >
                              Rediger
                            </Button>
                            <Button
                              size="small"
                              variant="destructive-secondary"
                              icon={<FeatherX />}
                              onClick={() => rejectDraft.mutate(email.id)}
                              disabled={rejectDraft.isPending}
                              data-testid={`button-reject-draft-${email.id}`}
                            >
                              Afvis
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI Status Footer */}
          <div className={`flex w-full items-center gap-4 border-t border-solid border-neutral-border px-4 md:px-6 py-4 ${hasPendingDrafts ? 'bg-amber-50' : 'bg-brand-50'}`}>
            <div className="flex h-8 w-8 flex-none items-center justify-center">
              {hasPendingDrafts ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
              ) : (
                <Loader />
              )}
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start">
              {hasPendingDrafts ? (
                <>
                  <span className="text-body-bold font-body-bold text-amber-700">
                    AI kladde afventer din godkendelse
                  </span>
                  <span className="text-body font-body text-amber-700">
                    Gennemgå kladden ovenfor og godkend eller rediger før afsendelse
                  </span>
                </>
              ) : (
                <>
                  <span className="text-body-bold font-body-bold text-brand-700">
                    AI forhandler aktivt på dine vegne
                  </span>
                  <span className="text-body font-body text-brand-700">
                    Vores AI arbejder på at få dig det bedst mulige tilbud fra {companyName}
                  </span>
                </>
              )}
            </div>
            <Badge variant={hasPendingDrafts ? "warning" : "neutral"}>
              {hasPendingDrafts ? 'Afventer' : 'Aktiv'}
            </Badge>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
