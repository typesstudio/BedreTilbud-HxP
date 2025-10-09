import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Send, Clock, CheckCircle, Eye, Mail, RefreshCw } from "lucide-react";
import UserSelector from "@/components/user-selector";

export default function OffersOverview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");

  if (!userId) {
    setLocation("/onboarding");
    return null;
  }

  // Get user stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats", userId],
  });

  // Get email threads
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/emails/threads", userId],
  });

  // Get comparisons
  const { data: comparisons = [] } = useQuery({
    queryKey: ["/api/comparisons/user", userId],
  });

  // Check inbox mutation
  const checkInboxMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/emails/check-inbox", {});
      return response.json();
    },
    onSuccess: () => {
      // Refresh threads and comparisons
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/comparisons/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats", userId] });
      toast({
        title: "Indbakke tjekket",
        description: "Nye emails er blevet hentet",
      });
    },
    onError: () => {
      toast({
        title: "Fejl",
        description: "Kunne ikke tjekke indbakke",
        variant: "destructive",
      });
    },
  });

  // Disabled auto-check due to Gmail scope limitations
  // Manual check button is available instead

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="secondary" className="status-badge status-sent">
            <Send className="w-4 h-4" />
            Sendt
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="status-badge status-pending">
            <Clock className="w-4 h-4" />
            Afventer svar
          </Badge>
        );
      case "received":
        return (
          <Badge variant="secondary" className="status-badge status-received">
            <CheckCircle className="w-4 h-4" />
            Modtaget
          </Badge>
        );
      default:
        return null;
    }
  };

  const getComparisonForThread = (threadId: string) => {
    return (comparisons as any[]).find((comp: any) => 
      (threads as any[]).find((t: any) => t.id === threadId && t.companyId === comp.companyId)
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">BedreTilbud</h1>
                <p className="text-sm text-muted-foreground">Find bedre forsikringer</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-foreground hover:text-primary font-medium">Oversigt</a>
              <a href="#" className="text-muted-foreground hover:text-primary font-medium">Sammenligning</a>
              <a href="#" className="text-muted-foreground hover:text-primary font-medium">Beskeder</a>
              <UserSelector />
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-3">Tilbudsoversigt</h2>
                <p className="text-lg text-muted-foreground">
                  Følg status på dine forespørgsler og modtagne tilbud
                </p>
              </div>
              <Button
                onClick={() => setLocation("/upload-offer")}
                variant="default"
                className="gap-2"
                data-testid="button-upload-offer"
              >
                <Mail className="w-5 h-5" />
                <span>Upload modtaget tilbud</span>
              </Button>
            </div>

            {stats ? (
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <Card className="shadow-card border-2 border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">Sendt</span>
                      <Send className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-4xl font-bold text-foreground" data-testid="stats-sent">
                      {(stats as any).sent}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-card border-2 border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">Afventer svar</span>
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-4xl font-bold text-foreground" data-testid="stats-pending">
                      {(stats as any).pending}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-card border-2 border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">Modtaget</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-4xl font-bold text-foreground" data-testid="stats-received">
                      {(stats as any).received}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* Offers by Category */}
            {(threads as any[]).length === 0 && (comparisons as any[]).length === 0 ? (
              <Card className="shadow-card text-center p-8">
                <CardContent>
                  <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Ingen forespørgsler endnu
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Start med at uploade dine forsikringsdokumenter og send forespørgsler til selskaber.
                  </p>
                  <Button
                    onClick={() => setLocation("/onboarding")}
                    data-testid="button-start-onboarding"
                  >
                    Kom i gang
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {/* Modtagne tilbud med sammenligninger */}
                {(comparisons as any[]).length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      Modtagne tilbud
                    </h3>
                    <div className="space-y-4">
                      {(comparisons as any[]).map((comparison: any) => (
                        <Card
                          key={comparison.id}
                          className="shadow-card p-6 border-2 border-green-200 hover:shadow-card-lg transition-shadow"
                          data-testid={`comparison-card-${comparison.id}`}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-green-50 rounded-lg flex items-center justify-center">
                                  <span className="text-2xl font-bold text-green-600">
                                    {comparison.company?.name?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="text-xl font-semibold text-foreground">
                                    {comparison.company?.name || 'Ukendt selskab'}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    Modtaget {new Date(comparison.createdAt).toLocaleDateString('da-DK')}
                                  </p>
                                </div>
                              </div>
                              <Badge className="bg-green-600 text-white">Klar til sammenligning</Badge>
                            </div>

                            <div className="flex flex-wrap gap-3 mb-4">
                              <Badge variant="secondary" className="bg-green-50 text-green-700 text-lg px-4 py-2">
                                Spar {comparison.savings || 0} kr./år
                              </Badge>
                              {comparison.comparisonData?.pros?.slice(0, 2).map((pro: string, index: number) => (
                                <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700">
                                  {pro}
                                </Badge>
                              ))}
                            </div>

                            <Button
                              className="w-full"
                              size="lg"
                              onClick={() => setLocation(`/comparison/${comparison.id}`)}
                              data-testid={`button-view-comparison-${comparison.id}`}
                            >
                              <Eye className="mr-2 w-5 h-5" />
                              Se fuld sammenligning
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afventende forespørgsler */}
                {(threads as any[]).filter((t: any) => t.status !== 'received' && !getComparisonForThread(t.id)).length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <Clock className="w-6 h-6 text-accent" />
                      Afventer svar
                    </h3>
                    <div className="space-y-4">
                      {(threads as any[])
                        .filter((t: any) => t.status !== 'received' && !getComparisonForThread(t.id))
                        .map((thread: any) => (
                          <Card
                            key={thread.id}
                            className="shadow-card p-6 border-2 border-border hover:shadow-card-lg transition-shadow"
                            data-testid={`pending-card-${thread.id}`}
                          >
                            <CardContent className="p-0">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center">
                                    <span className="text-2xl font-bold text-primary">
                                      {thread.company?.name?.charAt(0) || '?'}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="text-xl font-semibold text-foreground">
                                      {thread.company?.name || 'Ukendt selskab'}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      Sendt {new Date(thread.createdAt).toLocaleDateString('da-DK')}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="secondary">Afventer</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(threads as any[]).length > 0 && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/onboarding")}
                  data-testid="button-add-more-requests"
                >
                  Tilføj flere forespørgsler
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
