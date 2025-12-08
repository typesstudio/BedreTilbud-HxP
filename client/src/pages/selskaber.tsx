import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { CheckboxCard } from "@/ui/components/CheckboxCard";
import { LinkButton } from "@/ui/components/LinkButton";
import { TextField } from "@/ui/components/TextField";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FeatherCheck,
  FeatherGift,
  FeatherMail,
  FeatherSend,
  FeatherUsers,
  FeatherZap,
  FeatherBuilding
} from "@subframe/core";

function LoadingCompanies() {
  return (
    <div className="flex w-full flex-col items-center justify-center bg-neutral-50 px-8 py-8">
      <div className="flex w-full max-w-[768px] flex-col items-start gap-8">
        <div className="flex w-full flex-col items-start gap-2">
          <div className="flex h-9 w-80 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
          <div className="flex h-5 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
        </div>
        <div className="flex h-12 w-full flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
        <div className="flex w-full flex-col items-start gap-4">
          <div className="w-full items-start gap-4 grid grid-cols-2">
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex grow shrink-0 basis-0 items-center gap-4 rounded-lg border border-solid border-neutral-border bg-white px-4 py-4">
              <div className="flex h-5 w-5 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-12 w-12 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-200" />
          <div className="flex h-12 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
        </div>
        <div className="flex w-full items-start gap-8">
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex h-10 w-10 flex-none items-start rounded-full bg-neutral-200 animate-pulse" />
            <div className="flex h-6 w-40 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
            <div className="flex h-5 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
            <div className="flex h-10 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
            <div className="flex w-full items-center gap-2">
              <div className="flex h-4 w-4 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-4 w-48 flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
            </div>
            <div className="flex h-10 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
          </div>
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-white px-6 py-6">
            <div className="flex w-full items-center justify-between">
              <div className="flex h-10 w-10 flex-none items-start rounded-full bg-neutral-200 animate-pulse" />
              <div className="flex h-6 w-24 flex-none items-start rounded-full bg-neutral-200 animate-pulse" />
            </div>
            <div className="flex h-6 w-40 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
            <div className="flex h-5 w-full flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
            <div className="flex w-full flex-col items-start gap-2">
              <div className="flex w-full items-center gap-2">
                <div className="flex h-4 w-4 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-40 flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
              <div className="flex w-full items-center gap-2">
                <div className="flex h-4 w-4 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-40 flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
              <div className="flex w-full items-center gap-2">
                <div className="flex h-4 w-4 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
                <div className="flex h-4 w-40 flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
              </div>
            </div>
            <div className="flex w-full gap-2 items-baseline">
              <div className="flex h-10 w-24 flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
              <div className="flex h-5 w-32 flex-none items-start rounded-md bg-neutral-100 animate-pulse" />
            </div>
            <div className="flex h-10 w-full flex-none items-start rounded-md bg-neutral-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Selskaber() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [friendEmail, setFriendEmail] = useState("");

  const { data: companies = [], isLoading: companiesLoading } = useQuery<any[]>({
    queryKey: ["/api/companies"],
  });

  if (!userId) {
    return (
      <AppLayoutWithNav userId="">
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-default-background px-6 py-12">
          <span className="text-heading-2 font-heading-2 text-default-font">
            Du skal logge ind først
          </span>
          <span className="text-body font-body text-subtext-color text-center">
            For at indhente tilbud skal du først uploade dine nuværende forsikringer
          </span>
          <Button
            variant="brand-primary"
            onClick={() => setLocation("/onboarding")}
            data-testid="button-go-to-onboarding"
          >
            Start her
          </Button>
        </div>
      </AppLayoutWithNav>
    );
  }

  const { data: documentsResponse } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/documents/user", userId],
    enabled: !!userId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/documents/user/${userId}?documentType=current`);
      return response.json();
    },
  });
  const documents = documentsResponse?.data || [];

  const sendInquiriesMutation = useMutation({
    mutationFn: async (data: { userId: string; companyIds: string[]; documentId?: string }) => {
      const response = await apiRequest("POST", "/api/emails/send-inquiries", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isDraft) {
        toast({
          title: "Forespørgsler oprettet",
          description: "Dine forespørgsler afventer godkendelse fra administrator før de sendes.",
        });
      } else {
        toast({
          title: "Forespørgsler sendt",
          description: "Dine forespørgsler er sendt til de valgte selskaber",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/drafts"] });
      setLocation("/offers");
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende forespørgsler",
        variant: "destructive",
      });
    },
  });

  const handleSendInquiries = () => {
    if (selectedCompanies.length === 0) {
      toast({
        title: "Vælg selskaber",
        description: "Du skal vælge mindst ét forsikringsselskab",
        variant: "destructive",
      });
      return;
    }

    const documentId = documents.length > 0 ? documents[0].id : undefined;

    sendInquiriesMutation.mutate({ 
      userId, 
      companyIds: selectedCompanies,
      documentId 
    });
  };

  const toggleCompany = (companyId: string) => {
    if (selectedCompanies.includes(companyId)) {
      setSelectedCompanies(selectedCompanies.filter(id => id !== companyId));
    } else {
      setSelectedCompanies([...selectedCompanies, companyId]);
    }
  };

  const midPoint = Math.ceil((companies as any[]).length / 2);
  const leftColumnCompanies = (companies as any[]).slice(0, midPoint);
  const rightColumnCompanies = (companies as any[]).slice(midPoint);

  if (companiesLoading) {
    return (
      <AppLayoutWithNav userId={userId}>
        <LoadingCompanies />
      </AppLayoutWithNav>
    );
  }

  return (
    <AppLayoutWithNav userId={userId}>
      <div className="flex h-full w-full flex-col items-center gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full max-w-[900px] flex-col items-start gap-6">
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Vælg forsikringsselskaber
            </span>
            <span className="text-body font-body text-subtext-color">
              Vælg hvilke forsikringsselskaber du vil have tilbud fra, eller lad
              os automatisk finde de bedste for dig
            </span>
          </div>

          <div className="flex w-full items-center justify-end gap-2">
            <Button
              className="h-10 grow shrink-0 basis-0"
              variant="brand-primary"
              size="large"
              disabled={selectedCompanies.length === 0 || sendInquiriesMutation.isPending}
              onClick={handleSendInquiries}
              data-testid="button-send-inquiries"
            >
              {sendInquiriesMutation.isPending 
                ? "Sender..." 
                : selectedCompanies.length > 0 
                  ? `Få bedre tilbud (${selectedCompanies.length} valgt)`
                  : "Få bedre tilbud"
              }
            </Button>
          </div>

          {companiesLoading ? (
            <div className="flex w-full items-center justify-center py-12">
              <span className="text-body font-body text-subtext-color">Indlæser selskaber...</span>
            </div>
          ) : (
            <div className="flex w-full items-start gap-4 mobile:flex-col">
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 self-stretch overflow-y-auto mobile:w-full">
                {leftColumnCompanies.map((company: any) => (
                  <CheckboxCard
                    key={company.id}
                    className="h-auto w-full flex-none"
                    checked={selectedCompanies.includes(company.id)}
                    onCheckedChange={() => toggleCompany(company.id)}
                    data-testid={`checkbox-company-${company.id}`}
                  >
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-neutral-100">
                      {company.logoUrl ? (
                        <img
                          className="h-12 w-12 flex-none rounded-md object-cover"
                          src={company.logoUrl}
                          alt={company.name}
                        />
                      ) : (
                        <FeatherBuilding className="text-neutral-500 w-6 h-6" />
                      )}
                    </div>
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <div className="flex w-full items-center gap-2">
                        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                          {company.name}
                        </span>
                      </div>
                      <span className="text-body font-body text-subtext-color">
                        {company.description || "Forsikringsselskab"}
                      </span>
                    </div>
                  </CheckboxCard>
                ))}
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-3 self-stretch overflow-y-auto mobile:w-full">
                {rightColumnCompanies.map((company: any) => (
                  <CheckboxCard
                    key={company.id}
                    className="h-auto w-full flex-none"
                    checked={selectedCompanies.includes(company.id)}
                    onCheckedChange={() => toggleCompany(company.id)}
                    data-testid={`checkbox-company-${company.id}`}
                  >
                    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-neutral-100">
                      {company.logoUrl ? (
                        <img
                          className="h-12 w-12 flex-none rounded-md object-cover"
                          src={company.logoUrl}
                          alt={company.name}
                        />
                      ) : (
                        <FeatherBuilding className="text-neutral-500 w-6 h-6" />
                      )}
                    </div>
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <div className="flex w-full items-center gap-2">
                        <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
                          {company.name}
                        </span>
                      </div>
                      <span className="text-body font-body text-subtext-color">
                        {company.description || "Forsikringsselskab"}
                      </span>
                    </div>
                  </CheckboxCard>
                ))}
              </div>
            </div>
          )}

          <div className="flex w-full items-center gap-4">
            <div className="flex h-px grow shrink-0 basis-0 flex-col items-center gap-2 bg-neutral-border" />
            <LinkButton
              onClick={() => {}}
              data-testid="link-more-offers"
            >
              Få flere bedre tilbud
            </LinkButton>
            <div className="flex h-px grow shrink-0 basis-0 flex-col items-center gap-2 bg-neutral-border" />
          </div>

          <div className="flex w-full items-start gap-6 mobile:flex-col">
            <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-8 shadow-sm">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-brand-100">
                <FeatherUsers className="text-heading-2 font-heading-2 text-brand-600" />
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                <span className="text-heading-2 font-heading-2 text-default-font">
                  Inviter en ven
                </span>
                <span className="text-body font-body text-subtext-color">
                  Få 3 ekstra tilbud når din ven uploader deres forsikring
                </span>
              </div>
              <TextField
                className="h-auto w-full flex-none"
                label="Venens email"
                helpText=""
                icon={<FeatherMail />}
              >
                <TextField.Input
                  placeholder="navn@email.dk"
                  value={friendEmail}
                  onChange={(event) => setFriendEmail(event.target.value)}
                  data-testid="input-friend-email"
                />
              </TextField>
              <div className="flex w-full items-center gap-2 rounded-md bg-success-50 px-4 py-3">
                <FeatherGift className="text-body font-body text-success-700" />
                <span className="grow shrink-0 basis-0 text-caption font-caption text-success-700">
                  I får begge 3 gratis tilbud ekstra
                </span>
              </div>
              <Button
                className="h-10 w-full flex-none"
                variant="neutral-primary"
                size="large"
                icon={<FeatherSend />}
                onClick={() => {
                  toast({
                    title: "Kommer snart",
                    description: "Inviter en ven funktionen kommer snart",
                  });
                }}
                data-testid="button-send-invitation"
              >
                Send invitation
              </Button>
            </div>

            <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-start gap-6 self-stretch rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-8 shadow-sm">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-warning-100">
                <FeatherZap className="text-heading-2 font-heading-2 text-warning-600" />
              </div>
              <div className="flex w-full flex-col items-start gap-2">
                <div className="flex w-full items-center gap-2">
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    Premium matching
                  </span>
                  <Badge variant="warning">Bedste værdi</Badge>
                </div>
                <span className="text-body font-body text-subtext-color">
                  Få ubegrænsede tilbud fra alle forsikringsselskaber
                </span>
              </div>
              <div className="flex w-full flex-col items-start gap-3">
                <div className="flex items-center gap-2">
                  <FeatherCheck className="text-body font-body text-success-600" />
                  <span className="text-body font-body text-default-font">
                    Ubegrænsede tilbud
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FeatherCheck className="text-body font-body text-success-600" />
                  <span className="text-body font-body text-default-font">
                    Prioriteret support
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FeatherCheck className="text-body font-body text-success-600" />
                  <span className="text-body font-body text-default-font">
                    Avanceret forhandling
                  </span>
                </div>
              </div>
              <div className="flex w-full items-end gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  299 kr
                </span>
                <span className="text-body font-body text-subtext-color">
                  / engangsbetaling
                </span>
              </div>
              <Button
                className="h-10 w-full flex-none"
                size="large"
                icon={<FeatherZap />}
                onClick={() => {
                  toast({
                    title: "Kommer snart",
                    description: "Premium matching kommer snart",
                  });
                }}
                data-testid="button-upgrade-premium"
              >
                Opgradér nu
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
