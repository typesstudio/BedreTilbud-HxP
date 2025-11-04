import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "../../../src/ui/components/Button";
import { IconWithBackground } from "../../../src/ui/components/IconWithBackground";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { 
  FeatherRefreshCw,
  FeatherMail,
  FeatherCheckCircle,
  FeatherAlertCircle,
  FeatherUser,
  FeatherHash,
  FeatherClock
} from "@subframe/core";

export default function AdminTesting() {
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Get all users
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Get Gmail status
  const { data: gmailStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/gmail/status"],
  });

  // Get email tracking for selected user
  const { data: emailTracking, refetch: refetchTracking } = useQuery({
    queryKey: ["/api/debug/email-tracking", selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/debug/email-tracking?userId=${selectedUserId}`);
      return response.json();
    },
  });

  // Manual inbox check mutation
  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      toast({
        title: "⏳ Tjekker indbakke...",
        description: "Henter emails, processer PDFs og laver sammenligninger. Dette kan tage 30-60 sekunder.",
      });
      const response = await apiRequest("POST", "/api/emails/check-inbox");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Indbakke tjekket!",
        description: data.message || "Alle nye emails er blevet processeret og sammenligninger er lavet",
      });
      refetchTracking();
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Fejl",
        description: error.message || "Kunne ikke tjekke indbakke",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('da-DK');
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-8 bg-default-background py-12">
        <div className="flex w-full max-w-[1200px] flex-col items-start gap-8">
          {/* Header */}
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Admin & Testing
            </span>
            <span className="text-body font-body text-subtext-color">
              Manuel email tjek og debug værktøjer
            </span>
          </div>

          {/* Gmail Status Card */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <IconWithBackground 
                  size="medium" 
                  icon={<FeatherMail />} 
                  variant={gmailStatus?.authorized ? "success" : "neutral"}
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Gmail Status
                </span>
              </div>
              <Button
                variant="neutral-secondary"
                size="small"
                onClick={() => refetchStatus()}
                disabled={statusLoading}
                data-testid="button-refresh-status"
              >
                <FeatherRefreshCw className={statusLoading ? "animate-spin" : ""} />
                Opdater
              </Button>
            </div>

            {statusLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-body font-body text-subtext-color">Checker status...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
                  {gmailStatus?.configured ? (
                    <FeatherCheckCircle className="text-success-600 w-5 h-5" />
                  ) : (
                    <FeatherAlertCircle className="text-error-600 w-5 h-5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">OAuth Konfigureret</span>
                    <span className="text-caption font-caption text-subtext-color">
                      {gmailStatus?.configured ? "Ja" : "Nej"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
                  {gmailStatus?.authorized ? (
                    <FeatherCheckCircle className="text-success-600 w-5 h-5" />
                  ) : (
                    <FeatherAlertCircle className="text-error-600 w-5 h-5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">Autoriseret</span>
                    <span className="text-caption font-caption text-subtext-color">
                      {gmailStatus?.authorized ? "Ja" : "Nej"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
                  {gmailStatus?.hasRefreshToken ? (
                    <FeatherCheckCircle className="text-success-600 w-5 h-5" />
                  ) : (
                    <FeatherAlertCircle className="text-error-600 w-5 h-5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">Refresh Token</span>
                    <span className="text-caption font-caption text-subtext-color">
                      {gmailStatus?.hasRefreshToken ? "Tilgængelig" : "Mangler"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
                  <FeatherClock className="text-brand-600 w-5 h-5" />
                  <div className="flex flex-col">
                    <span className="text-body-bold font-body-bold text-default-font">Udløber</span>
                    <span className="text-caption font-caption text-subtext-color">
                      {gmailStatus?.expiresAt ? formatDate(gmailStatus.expiresAt) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Inbox Check */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border-2 border-solid border-brand-200 bg-brand-50 px-6 py-6">
            <div className="flex items-center gap-3">
              <IconWithBackground 
                size="medium" 
                icon={<FeatherRefreshCw />} 
                variant="brand"
              />
              <div className="flex flex-col">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Manuel Indbakke Tjek
                </span>
                <span className="text-body font-body text-subtext-color">
                  Tjek Gmail indbakke for nye emails med det samme (normalt hver 5. minut)
                </span>
              </div>
            </div>

            <Button
              variant="brand-primary"
              size="large"
              onClick={() => checkInboxMutation.mutate()}
              disabled={checkInboxMutation.isPending || !gmailStatus?.authorized}
              iconRight={<FeatherRefreshCw />}
              data-testid="button-check-inbox"
            >
              {checkInboxMutation.isPending ? "Tjekker..." : "Tjek Indbakke Nu"}
            </Button>

            {!gmailStatus?.authorized && (
              <div className="flex items-center gap-2 rounded-md bg-error-50 px-4 py-2">
                <FeatherAlertCircle className="text-error-600 w-5 h-5" />
                <span className="text-body font-body text-error-700">
                  Gmail skal være autoriseret før du kan tjekke indbakken
                </span>
              </div>
            )}
          </div>

          {/* Email Tracking Debug */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <IconWithBackground 
                  size="medium" 
                  icon={<FeatherHash />} 
                  variant="brand"
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Email Tracking Debug
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <FeatherUser className="text-brand-600 w-5 h-5" />
                <Select 
                  onValueChange={setSelectedUserId} 
                  value={selectedUserId}
                >
                  <SelectTrigger 
                    className="w-full max-w-md"
                    data-testid="select-user-tracking"
                  >
                    <SelectValue placeholder="Vælg bruger for at se email tracking" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users as any[]).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {emailTracking && (
                <div className="flex flex-col gap-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-md bg-brand-50 px-4 py-3">
                      <span className="text-heading-2 font-heading-2 text-brand-600">
                        {emailTracking.totalThreads}
                      </span>
                      <br />
                      <span className="text-body font-body text-brand-700">Email Tråde</span>
                    </div>
                    
                    <div className="rounded-md bg-neutral-50 px-4 py-3">
                      <span className="text-heading-2 font-heading-2 text-default-font">
                        {emailTracking.threads?.filter((t: any) => t.thread.requestToken && t.thread.requestToken !== 'NOT SET').length || 0}
                      </span>
                      <br />
                      <span className="text-body font-body text-subtext-color">Med Tokens</span>
                    </div>

                    <div className="rounded-md bg-neutral-50 px-4 py-3">
                      <span className="text-heading-2 font-heading-2 text-default-font">
                        {emailTracking.threads?.filter((t: any) => t.emailCount.inbound > 0).length || 0}
                      </span>
                      <br />
                      <span className="text-body font-body text-subtext-color">Med Svar</span>
                    </div>
                  </div>

                  {/* Threads List */}
                  <div className="flex flex-col gap-2">
                    <span className="text-body-bold font-body-bold text-default-font">Email Tråde:</span>
                    
                    {emailTracking.threads?.map((item: any) => (
                      <div 
                        key={item.thread.id}
                        className="flex flex-col gap-2 rounded-lg border border-solid border-neutral-border bg-white px-4 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <IconWithBackground 
                              size="small" 
                              icon={<FeatherMail />} 
                              variant={item.emailCount.inbound > 0 ? "success" : "neutral"}
                            />
                            <div className="flex flex-col">
                              <span className="text-body-bold font-body-bold text-default-font">
                                {item.company?.name || "Ukendt"}
                              </span>
                              <span className="text-caption font-caption text-subtext-color">
                                {item.thread.subject}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.thread.requestToken && item.thread.requestToken !== 'NOT SET' && (
                              <div className="rounded-md bg-brand-50 px-3 py-1">
                                <span className="text-body-bold font-body-bold text-brand-700">
                                  {item.thread.requestToken}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-caption font-caption">
                          <div className="flex flex-col">
                            <span className="text-subtext-color">Status:</span>
                            <span className="text-default-font font-body-bold">{item.thread.status}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-subtext-color">Sendt:</span>
                            <span className="text-default-font font-body-bold">{item.emailCount.outbound}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-subtext-color">Modtaget:</span>
                            <span className="text-default-font font-body-bold">{item.emailCount.inbound}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-subtext-color">Reply-To:</span>
                            <span className="text-default-font font-body-bold text-xs">
                              {item.thread.replyToEmail || 'IKKE SAT'}
                            </span>
                          </div>
                        </div>

                        {item.thread.createdAt && (
                          <span className="text-caption font-caption text-subtext-color">
                            Oprettet: {formatDate(item.thread.createdAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
