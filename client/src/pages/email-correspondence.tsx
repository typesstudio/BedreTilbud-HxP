import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { Loader } from "@/ui/components/Loader";
import { FeatherBarChart2 } from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";

export default function EmailCorrespondence() {
  const { threadId } = useParams();
  const [location, setLocation] = useLocation();
  const userId = localStorage.getItem("userId");

  const { data: threadData, isLoading } = useQuery({
    queryKey: ["/api/emails/thread", threadId],
    enabled: !!threadId,
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
        src={company?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=e5e5e5&color=737373`}
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

  const comparisonPath = comparisonId ? `/sammenligning/${comparisonId}` : "/offers";

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
                <div key={email.id || index} className="flex w-full items-start gap-4" data-testid={`message-${index}`}>
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

          {/* AI Status Footer */}
          <div className="flex w-full items-center gap-4 border-t border-solid border-neutral-border bg-brand-50 px-4 md:px-6 py-4">
            <div className="flex h-8 w-8 flex-none items-center justify-center">
              <Loader />
            </div>
            <div className="flex grow shrink-0 basis-0 flex-col items-start">
              <span className="text-body-bold font-body-bold text-brand-700">
                AI forhandler aktivt på dine vegne
              </span>
              <span className="text-body font-body text-brand-700">
                Vores AI arbejder på at få dig det bedst mulige tilbud fra {companyName}
              </span>
            </div>
            <Badge>Aktiv</Badge>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
