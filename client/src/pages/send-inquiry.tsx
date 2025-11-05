import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "../../../src/ui/components/Button";
import { IconWithBackground } from "../../../src/ui/components/IconWithBackground";
import { LinkButton } from "../../../src/ui/components/LinkButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";
import { 
  FeatherArrowLeft, 
  FeatherSend,
  FeatherBuilding,
  FeatherFileText,
  FeatherUser,
  FeatherCheck
} from "@subframe/core";

export default function SendInquiry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  // Get all users
  const { data: usersResponse, isLoading: usersLoading } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/users"],
  });
  const users = usersResponse?.data || [];

  // Get companies
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
  });

  // Get user's current insurance documents
  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<{ data: any[]; pagination: any }>({
    queryKey: ["/api/documents/user", selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/documents/user/${selectedUserId}?documentType=current`);
      return response.json();
    },
  });
  const documents = documentsResponse?.data || [];

  // Send inquiries mutation
  const sendInquiriesMutation = useMutation({
    mutationFn: async (data: { userId: string; companyIds: string[]; documentId?: string }) => {
      const response = await apiRequest("POST", "/api/emails/send-inquiries", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Forespørgsler sendt",
        description: "Forespørgsler er sendt til de valgte selskaber",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emails/threads"] });
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
    if (!selectedUserId) {
      toast({
        title: "Vælg bruger",
        description: "Du skal vælge en bruger",
        variant: "destructive",
      });
      return;
    }

    if (selectedCompanies.length === 0) {
      toast({
        title: "Vælg selskaber",
        description: "Du skal vælge mindst ét forsikringsselskab",
        variant: "destructive",
      });
      return;
    }

    const documentId = (documents as any[]).length > 0 ? (documents as any[])[0].id : undefined;

    sendInquiriesMutation.mutate({ 
      userId: selectedUserId, 
      companyIds: selectedCompanies,
      documentId 
    });
  };

  const selectedUser = (users as any[]).find((u: any) => u.id === selectedUserId);

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-8 bg-default-background py-12">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-8">
          {/* Header */}
          <div className="flex w-full flex-col items-start gap-2">
            <span className="text-heading-1 font-heading-1 text-default-font">
              Send Forespørgsel
            </span>
            <span className="text-body font-body text-subtext-color">
              Send brugerens nuværende forsikring til udvalgte selskaber for at få tilbud
            </span>
          </div>

          {/* Step 1: Select User */}
          <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
            <div className="flex items-center gap-3">
              <IconWithBackground 
                size="medium" 
                icon={<FeatherUser />} 
                variant="brand"
              />
              <span className="text-heading-3 font-heading-3 text-default-font">
                Vælg Bruger
              </span>
            </div>

            <div className="w-full">
              <Select 
                onValueChange={setSelectedUserId} 
                value={selectedUserId}
              >
                <SelectTrigger 
                  className="w-full"
                  data-testid="select-user"
                >
                  <SelectValue placeholder="Vælg en bruger" />
                </SelectTrigger>
                <SelectContent>
                  {usersLoading ? (
                    <SelectItem value="loading" disabled>Indlæser...</SelectItem>
                  ) : (users as any[]).length === 0 ? (
                    <SelectItem value="empty" disabled>Ingen brugere fundet</SelectItem>
                  ) : (
                    (users as any[]).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="w-full flex flex-col gap-2 rounded-md bg-neutral-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-body font-body text-subtext-color">Email:</span>
                  <span className="text-body-bold font-body-bold text-default-font">{selectedUser.email}</span>
                </div>
                {selectedUser.housingType && (
                  <div className="flex items-center justify-between">
                    <span className="text-body font-body text-subtext-color">Bolig:</span>
                    <span className="text-body-bold font-body-bold text-default-font">{selectedUser.housingType}</span>
                  </div>
                )}
                {selectedUser.deductible && (
                  <div className="flex items-center justify-between">
                    <span className="text-body font-body text-subtext-color">Selvrisiko:</span>
                    <span className="text-body-bold font-body-bold text-default-font">{selectedUser.deductible} kr.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Current Insurance Documents */}
          {selectedUserId && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex items-center gap-3">
                <IconWithBackground 
                  size="medium" 
                  icon={<FeatherFileText />} 
                  variant="brand"
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Nuværende Forsikringer
                </span>
              </div>

              {documentsLoading ? (
                <div className="w-full flex items-center justify-center py-8">
                  <span className="text-body font-body text-subtext-color">Indlæser dokumenter...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center gap-2 rounded-md bg-neutral-50 px-6 py-8">
                  <FeatherFileText className="text-subtext-color w-12 h-12" />
                  <span className="text-body-bold font-body-bold text-default-font">
                    Ingen forsikringer uploadet
                  </span>
                  <span className="text-body font-body text-subtext-color text-center">
                    Denne bruger har ikke uploadet nogen forsikringsdokumenter endnu
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  {(documents as any[]).map((doc: any) => (
                    <div 
                      key={doc.id}
                      className="flex items-center gap-3 rounded-md border border-solid border-neutral-border bg-white px-4 py-3"
                    >
                      <FeatherFileText className="text-brand-600 w-5 h-5" />
                      <div className="flex grow shrink-0 basis-0 flex-col items-start">
                        <span className="text-body-bold font-body-bold text-default-font">
                          {doc.fileName}
                        </span>
                        {doc.ocrData?.companyName && (
                          <span className="text-body font-body text-subtext-color">
                            {doc.ocrData.companyName}
                          </span>
                        )}
                      </div>
                      <FeatherCheck className="text-success-600 w-5 h-5" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Company Selection */}
          {selectedUserId && documents.length > 0 && (
            <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
              <div className="flex items-center gap-3">
                <IconWithBackground 
                  size="medium" 
                  icon={<FeatherBuilding />} 
                  variant="brand"
                />
                <span className="text-heading-3 font-heading-3 text-default-font">
                  Vælg Forsikringsselskaber
                </span>
              </div>

              <span className="text-body font-body text-subtext-color">
                Vælg hvilke selskaber du vil anmode om tilbud fra
              </span>

              <div className="flex w-full flex-col items-start gap-3">
                {(companies as any[]).map((company: any) => (
                  <div 
                    key={company.id}
                    className="flex w-full items-center gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-4 hover:bg-neutral-50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (selectedCompanies.includes(company.id)) {
                        setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                      } else {
                        setSelectedCompanies([...selectedCompanies, company.id]);
                      }
                    }}
                    data-testid={`company-option-${company.id}`}
                  >
                    <Checkbox
                      checked={selectedCompanies.includes(company.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCompanies([...selectedCompanies, company.id]);
                        } else {
                          setSelectedCompanies(selectedCompanies.filter(id => id !== company.id));
                        }
                      }}
                      className="w-6 h-6"
                    />
                    <IconWithBackground 
                      size="large" 
                      icon={<FeatherBuilding />} 
                    />
                    <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                      <span className="text-body-bold font-body-bold text-default-font">
                        {company.name}
                      </span>
                      <span className="text-body font-body text-subtext-color">
                        {company.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedCompanies.length > 0 && (
                <div className="flex w-full items-center gap-4 rounded-md bg-brand-50 px-6 py-4">
                  <IconWithBackground 
                    size="small" 
                    icon={<FeatherCheck />} 
                    variant="brand"
                  />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start">
                    <span className="text-body-bold font-body-bold text-brand-700">
                      {selectedCompanies.length} {selectedCompanies.length === 1 ? 'selskab' : 'selskaber'} valgt
                    </span>
                    <span className="text-body font-body text-brand-700">
                      AI genererer personlig forespørgsel til hvert selskab med token tracking
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex w-full items-center justify-between pt-4">
            <LinkButton
              icon={<FeatherArrowLeft />}
              onClick={() => setLocation("/offers")}
              data-testid="button-back"
            >
              Tilbage til tilbud
            </LinkButton>
            <Button
              disabled={
                sendInquiriesMutation.isPending || 
                !selectedUserId || 
                documents.length === 0 || 
                selectedCompanies.length === 0
              }
              iconRight={<FeatherSend />}
              onClick={handleSendInquiries}
              data-testid="button-send-inquiries"
            >
              Send forespørgsler
            </Button>
          </div>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
