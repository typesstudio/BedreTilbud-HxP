import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Edit, Download, Share, Bot } from "lucide-react";
import EmailThread from "@/components/email-thread";

export default function EmailCorrespondence() {
  const { threadId } = useParams();
  const [, setLocation] = useLocation();

  const { data: threadData, isLoading } = useQuery({
    queryKey: ["/api/emails/thread", threadId],
    enabled: !!threadId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Indlæser e-mail korrespondance...</p>
        </div>
      </div>
    );
  }

  if (!threadData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">E-mail tråd ikke fundet</h2>
          <Button onClick={() => setLocation("/offers")}>
            Tilbage til oversigt
          </Button>
        </div>
      </div>
    );
  }

  const { thread, company, emails = [] } = threadData;

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case "outbound":
        return (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            SENDT
          </Badge>
        );
      case "inbound":
        return (
          <Badge variant="secondary" className="bg-green-600 text-white">
            MODTAGET
          </Badge>
        );
      case "auto":
        return (
          <Badge variant="secondary" className="bg-accent text-white">
            AUTO-SVAR
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <Button 
                variant="ghost"
                onClick={() => setLocation("/offers")}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
                data-testid="button-back-to-offers"
              >
                <ArrowLeft className="w-5 h-5" />
                Tilbage
              </Button>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                E-mail korrespondance: {company?.name || 'Ukendt selskab'}
              </h2>
              <p className="text-lg text-muted-foreground">
                Se hele samtalen med forsikringsselskabet
              </p>
            </div>

            {/* Email Thread */}
            <Card className="shadow-card-lg">
              <CardContent className="p-8">
                {emails.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Ingen beskeder endnu
                    </h3>
                    <p className="text-muted-foreground">
                      E-mail korrespondance vil blive vist her, når den er tilgængelig.
                    </p>
                  </div>
                ) : (
                  <EmailThread
                    emails={emails}
                    company={company}
                    getDirectionBadge={getDirectionBadge}
                  />
                )}

                {/* Quick Actions */}
                <div className="mt-8 pt-8 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-4">Hurtige handlinger</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button data-testid="button-reply-manually">
                      <Edit className="mr-2 w-4 h-4" />
                      Skriv nyt svar
                    </Button>
                    <Button variant="outline" data-testid="button-download-attachments">
                      <Download className="mr-2 w-4 h-4" />
                      Download alle vedhæftninger
                    </Button>
                    <Button variant="outline" data-testid="button-share-conversation">
                      <Share className="mr-2 w-4 h-4" />
                      Del samtale
                    </Button>
                    {emails.some((email: any) => email.direction === 'auto') && (
                      <Button variant="outline" data-testid="button-edit-auto-response">
                        <Bot className="mr-2 w-4 h-4" />
                        Rediger AI-svar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
