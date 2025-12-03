import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { FeatherMail, FeatherMessageCircle } from "@subframe/core";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";

export default function EmailThreadsOverview() {
  const userId = localStorage.getItem("userId") || '';
  const [, setLocation] = useLocation();

  const { data: threadsData, isLoading } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: [`/api/emails/threads/${userId}`],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-subtext-color">Indlæser samtaler...</p>
          </div>
        </div>
      </AppLayoutWithNav>
    );
  }

  const threads = threadsData?.data || [];

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex h-full w-full flex-col bg-default-background px-4 md:px-12 py-6 md:py-12">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <FeatherMail className="w-8 h-8 text-brand-600" />
            <div>
              <h1 className="text-heading-1 font-heading-1 text-default-font">
                Din korrespondance
              </h1>
              <p className="text-body text-subtext-color">
                Her kan du se alle dine samtaler med forsikringsselskaber
              </p>
            </div>
          </div>

          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-lg p-12 text-center">
              <FeatherMessageCircle className="w-16 h-16 text-neutral-300 mb-4" />
              <h2 className="text-heading-2 font-heading-2 text-default-font mb-2">
                Ingen samtaler endnu
              </h2>
              <p className="text-body text-subtext-color mb-6">
                Når du sender forespørgsler til forsikringsselskaber, vil dine samtaler vises her.
              </p>
              <Button onClick={() => setLocation("/offers")} data-testid="button-go-to-offers">
                Gå til tilbud
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {threads.map((thread: any) => {
                const company = thread.company;
                const emailCount = thread.emailCount || 0;
                const lastEmailAt = thread.lastEmailAt;
                const subject = thread.subject;
                
                return (
                  <div
                    key={thread.id}
                    className="flex items-center gap-4 bg-white rounded-lg p-4 border border-neutral-border hover:border-brand-300 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/emails/${thread.id}`)}
                    data-testid={`thread-${thread.id}`}
                  >
                    <img
                      className="h-12 w-12 flex-none rounded-full object-cover bg-neutral-200"
                      src={company?.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(company?.name || 'Ukendt')}&background=e5e5e5&color=737373`}
                      alt={company?.name || 'Ukendt selskab'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-body-bold font-body-bold text-default-font truncate">
                          {company?.name || 'Ukendt selskab'}
                        </span>
                        {thread.status === 'received' && (
                          <Badge variant="success" data-testid={`badge-received-${thread.id}`}>
                            Modtaget svar
                          </Badge>
                        )}
                        {thread.status === 'pending' && (
                          <Badge variant="neutral" data-testid={`badge-pending-${thread.id}`}>
                            Afventer
                          </Badge>
                        )}
                      </div>
                      <p className="text-body text-subtext-color truncate">
                        {subject || 'Ingen emne'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-caption text-subtext-color">
                        {lastEmailAt ? format(new Date(lastEmailAt), "d. MMM", { locale: da }) : ''}
                      </span>
                      <span className="text-caption text-subtext-color">
                        {emailCount} {emailCount === 1 ? 'besked' : 'beskeder'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
