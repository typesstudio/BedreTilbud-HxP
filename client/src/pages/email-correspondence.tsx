import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/ui";
import { TextField } from "@/ui";
import { DefaultPageLayout } from "@/ui";
import { FeatherBarChart2, FeatherSend, FeatherArrowLeft } from "@subframe/core";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { Navigation } from "@/components/Navigation";

export default function EmailCorrespondence() {
  const { threadId } = useParams();
  const [, setLocation] = useLocation();
  const userId = localStorage.getItem("userId");

  const { data: threadData, isLoading } = useQuery({
    queryKey: ["/api/emails/thread", threadId],
    enabled: !!threadId,
  });

  if (isLoading) {
    return (
      <DefaultPageLayout>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-subtext-color">Indlæser beskedtråd...</p>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  if (!threadData) {
    return (
      <DefaultPageLayout>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-heading-2 font-heading-2 text-default-font mb-4">Tråd ikke fundet</h2>
            <Button onClick={() => setLocation("/offers-overview")}>
              Tilbage til oversigt
            </Button>
          </div>
        </div>
      </DefaultPageLayout>
    );
  }

  const { thread, company, emails = [] } = (threadData as any) || {};
  const companyName = company?.name || 'Ukendt selskab';

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: da });
    } catch {
      return '';
    }
  };

  const getMessageBgClass = (direction: string) => {
    if (direction === 'auto' || direction === 'outbound') {
      return 'bg-neutral-50';
    }
    return 'bg-brand-50';
  };

  const getAvatarContent = (direction: string) => {
    if (direction === 'auto' || direction === 'outbound') {
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
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=e5e5e5&color=737373`}
        alt={companyName}
      />
    );
  };

  const getSenderName = (direction: string) => {
    if (direction === 'auto' || direction === 'outbound') {
      return 'BedreTilbud AI';
    }
    return companyName;
  };

  return (
    <DefaultPageLayout>
      <Navigation userId={userId || undefined} />
      <div className="flex h-full w-full items-center justify-center bg-default-background">
        <div className="flex w-full max-w-[900px] flex-none flex-col items-center justify-center rounded-md bg-white" style={{ height: 'calc(100vh - 100px)' }}>
          {/* Header */}
          <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-6 py-4">
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
                setLocation("/offers-overview");
              }}
              data-testid="button-view-offer"
            >
              Se tilbudet
            </Button>
          </div>

          {/* AI Status Banner */}
          {thread?.status === 'sent' && (
            <div className="flex w-full items-center gap-4 bg-brand-50 px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-2 w-2 flex-none items-start rounded-full bg-brand-500 animate-pulse" />
                <span className="text-body-bold font-body-bold text-brand-700">
                  BedreTilbud AI forhandler på dine vegne
                </span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-caption font-caption text-brand-600">
                  Afventer svar fra {companyName}
                </span>
                <Button
                  variant="brand-tertiary"
                  size="small"
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    alert('Pause AI funktionalitet kommer snart');
                  }}
                >
                  Pause AI
                </Button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-6 px-6 py-6 overflow-auto">
            {emails.length === 0 ? (
              <div className="flex w-full h-full items-center justify-center">
                <div className="text-center">
                  <span className="text-body font-body text-subtext-color">
                    Ingen beskeder endnu
                  </span>
                </div>
              </div>
            ) : (
              emails.map((email: any, index: number) => (
                <div key={email.id || index} className="flex w-full items-start gap-4">
                  {getAvatarContent(email.direction)}
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {getSenderName(email.direction)}
                      </span>
                      <span className="text-caption font-caption text-subtext-color">
                        {formatTime(email.sentAt)}
                      </span>
                    </div>
                    <div className={`flex items-start rounded-lg ${getMessageBgClass(email.direction)} px-4 py-3 max-w-2xl`}>
                      <span className="text-body font-body text-default-font whitespace-pre-wrap">
                        {email.body}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="flex w-full flex-col items-start gap-4 border-t border-solid border-neutral-border px-6 py-4">
            <div className="flex w-full flex-wrap items-start gap-2">
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  alert('Funktionalitet kommer snart');
                }}
              >
                Acceptér dette tilbud
              </Button>
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  alert('Funktionalitet kommer snart');
                }}
              >
                Spørg om dækningsdetaljer
              </Button>
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  alert('Funktionalitet kommer snart');
                }}
              >
                Bed om bedre pris
              </Button>
              <Button
                variant="neutral-tertiary"
                size="small"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  alert('Funktionalitet kommer snart');
                }}
              >
                Lad AI fortsætte
              </Button>
            </div>
            <div className="flex w-full items-center gap-4">
              <TextField className="grow" variant="filled" label="" helpText="">
                <TextField.Input
                  placeholder="Spring ind i samtalen eller lad AI fortsætte forhandlingen..."
                  value=""
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {}}
                />
              </TextField>
              <Button
                icon={<FeatherSend />}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  alert('Send besked funktionalitet kommer snart');
                }}
                data-testid="button-send-message"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DefaultPageLayout>
  );
}
