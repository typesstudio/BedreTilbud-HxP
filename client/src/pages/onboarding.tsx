import { useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../../src/ui/components/Button";
import { IconWithBackground } from "../../../src/ui/components/IconWithBackground";
import { LinkButton } from "../../../src/ui/components/LinkButton";
import { TextField } from "../../../src/ui/components/TextField";
import { DefaultPageLayout } from "../../../src/ui/layouts/DefaultPageLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FeatherArrowLeft, 
  FeatherArrowRight, 
  FeatherUpload,
  FeatherUser,
  FeatherCheck,
  FeatherSend,
  FeatherBuilding
} from "@subframe/core";
import FileUpload from "@/components/file-upload";

const userInfoSchema = z.object({
  email: z.string().email("Ugyldig email"),
  name: z.string().optional(),
  housingType: z.string().optional(),
  hasCar: z.boolean().optional(),
  deductible: z.string().optional(),
  age: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type UserInfoForm = z.infer<typeof userInfoSchema>;

export default function Onboarding() {
  const { step } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(parseInt(step || "1"));
  const [userId, setUserId] = useState(localStorage.getItem("userId"));
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  const form = useForm<UserInfoForm>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: {
      email: "",
      name: "",
      housingType: "",
      hasCar: false,
      deductible: "",
      age: "",
      additionalInfo: "",
    },
  });

  // Get companies
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
  });

  // Send inquiries mutation
  const sendInquiriesMutation = useMutation({
    mutationFn: async (data: { companyIds: string[] }) => {
      const response = await apiRequest("POST", "/api/emails/send-inquiries", {
        userId,
        companyIds: data.companyIds,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Forespørgsler sendt",
        description: "Dine forespørgsler er sendt til de valgte selskaber",
      });
      setLocation("/offers-overview");
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende forespørgsler",
        variant: "destructive",
      });
    },
  });

  const handleNext = useCallback(() => {
    if (currentStep < 3) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setLocation(`/onboarding/${nextStep}`);
    }
  }, [currentStep, setLocation]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setLocation(`/onboarding/${prevStep}`);
    }
  }, [currentStep, setLocation]);

  const onUserInfoSubmit = async (data: UserInfoForm) => {
    if (userId) {
      try {
        await apiRequest("PUT", `/api/users/${userId}`, data);
        toast({
          title: "Oplysninger opdateret",
          description: "Dine oplysninger er gemt",
        });
        handleNext();
      } catch (error: any) {
        if (error.message && error.message.includes('404')) {
          try {
            const response = await apiRequest("POST", "/api/users", data);
            const user = await response.json();
            setUserId(user.id);
            localStorage.setItem("userId", user.id);
            
            if (pendingFiles.length > 0) {
              const formData = new FormData();
              pendingFiles.forEach((file) => {
                formData.append("files", file);
              });
              formData.append("userId", user.id);
              formData.append("documentType", "current");
              
              const uploadResponse = await apiRequest("POST", "/api/documents/upload", formData);
              const documents = await uploadResponse.json();
              setUploadedFiles(documents);
              setPendingFiles([]);
            }
            
            toast({
              title: "Bruger oprettet",
              description: "Dine oplysninger er gemt",
            });
            handleNext();
          } catch (createError) {
            toast({
              title: "Fejl",
              description: "Kunne ikke oprette bruger",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Fejl",
            description: "Kunne ikke gemme oplysninger",
            variant: "destructive",
          });
        }
      }
    } else {
      try {
        const response = await apiRequest("POST", "/api/users", data);
        const user = await response.json();
        setUserId(user.id);
        localStorage.setItem("userId", user.id);
        
        if (pendingFiles.length > 0) {
          const formData = new FormData();
          pendingFiles.forEach((file) => {
            formData.append("files", file);
          });
          formData.append("userId", user.id);
          formData.append("documentType", "current");
          
          const uploadResponse = await apiRequest("POST", "/api/documents/upload", formData);
          const documents = await uploadResponse.json();
          setUploadedFiles(documents);
          setPendingFiles([]);
          
          toast({
            title: "Bruger oprettet",
            description: `Dine oplysninger og ${documents.length} dokumenter er gemt`,
          });
        } else {
          toast({
            title: "Bruger oprettet",
            description: "Dine oplysninger er gemt",
          });
        }
        
        handleNext();
      } catch (error) {
        toast({
          title: "Fejl",
          description: "Kunne ikke oprette bruger",
          variant: "destructive",
        });
      }
    }
  };

  const handleFilesUploaded = (files: FileList) => {
    const fileArray = Array.from(files);
    setPendingFiles(fileArray);
    
    const tempFiles: any[] = fileArray.map((file) => ({
      fileName: file.name,
      fileSize: file.size
    }));
    setUploadedFiles(tempFiles);
  };

  const handleSendInquiries = () => {
    if (selectedCompanies.length === 0) {
      toast({
        title: "Vælg selskaber",
        description: "Du skal vælge mindst ét forsikringsselskab",
        variant: "destructive",
      });
      return;
    }
    sendInquiriesMutation.mutate({ companyIds: selectedCompanies });
  };

  const getStepIcon = (stepNum: number) => {
    if (stepNum < currentStep) {
      return <FeatherCheck />;
    } else if (stepNum === 1) {
      return <FeatherUpload />;
    } else if (stepNum === 2) {
      return <FeatherUser />;
    } else {
      return <FeatherBuilding />;
    }
  };

  const getStepVariant = (stepNum: number): "success" | "brand" | "neutral" => {
    if (stepNum < currentStep) return "success";
    if (stepNum === currentStep) return "brand";
    return "neutral";
  };

  return (
    <DefaultPageLayout>
      <div className="container max-w-none flex h-full w-full flex-col items-center gap-8 bg-default-background py-12">
        <div className="flex w-full max-w-[768px] flex-col items-start gap-8">
          {/* Step Indicator */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <IconWithBackground 
                variant={getStepVariant(1)} 
                icon={getStepIcon(1)}
              />
              <span className={`text-body${currentStep === 1 ? '-bold font-body-bold' : ' font-body'} ${currentStep === 1 ? 'text-brand-600' : currentStep > 1 ? 'text-default-font' : 'text-subtext-color'}`}>
                Upload dokumenter
              </span>
            </div>
            <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
            <div className="flex items-center gap-2">
              <IconWithBackground 
                variant={getStepVariant(2)} 
                icon={getStepIcon(2)}
              />
              <span className={`text-body${currentStep === 2 ? '-bold font-body-bold' : ' font-body'} ${currentStep === 2 ? 'text-brand-600' : currentStep > 2 ? 'text-default-font' : 'text-subtext-color'}`}>
                Dine oplysninger
              </span>
            </div>
            <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
            <div className="flex items-center gap-2">
              <IconWithBackground 
                variant={getStepVariant(3)} 
                icon={getStepIcon(3)}
              />
              <span className={`text-body${currentStep === 3 ? '-bold font-body-bold' : ' font-body'} ${currentStep === 3 ? 'text-brand-600' : 'text-subtext-color'}`}>
                Få bedre tilbud
              </span>
            </div>
          </div>

          {/* Step 1: Upload Documents */}
          {currentStep === 1 && (
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex flex-col items-start gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  Upload dine nuværende forsikringer
                </span>
                <span className="text-body font-body text-subtext-color">
                  Upload PDF-dokumenter fra dine eksisterende forsikringer
                </span>
              </div>

              <div className="w-full">
                <FileUpload
                  onFilesUploaded={handleFilesUploaded}
                  uploadedFiles={uploadedFiles}
                  isUploading={false}
                />
              </div>

              <div className="flex w-full items-center justify-between pt-4">
                <LinkButton
                  icon={<FeatherArrowLeft />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => setLocation("/")}
                >
                  Tilbage
                </LinkButton>
                <Button
                  disabled={uploadedFiles.length === 0}
                  iconRight={<FeatherArrowRight />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => handleNext()}
                  data-testid="button-next-step"
                >
                  Næste trin
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: User Information */}
          {currentStep === 2 && (
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex flex-col items-start gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  Fortæl os om dig selv
                </span>
                <span className="text-body font-body text-subtext-color">
                  Vi hjælper dig med at finde de bedste forsikringstilbud
                </span>
              </div>

              <TextField
                className="h-auto w-full flex-none"
                label="E-mail"
                helpText="Din e-mailadresse bruges til at kontakte dig"
              >
                <TextField.Input
                  placeholder="f.eks. din@email.dk"
                  value={form.watch("email")}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    form.setValue("email", event.target.value);
                  }}
                  data-testid="input-email"
                />
              </TextField>

              <TextField
                className="h-auto w-full flex-none"
                label="Fulde navn"
                helpText="Indtast dit fornavn og efternavn"
              >
                <TextField.Input
                  placeholder="f.eks. indtast dit fulde navn"
                  value={form.watch("name") || ""}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    form.setValue("name", event.target.value);
                  }}
                  data-testid="input-name"
                />
              </TextField>

              <div className="w-full">
                <label className="text-label font-label text-default-font mb-1 block">Boligtype</label>
                <Select 
                  onValueChange={(value) => form.setValue("housingType", value)} 
                  value={form.watch("housingType") || ""}
                >
                  <SelectTrigger 
                    className="w-full"
                    data-testid="select-housing-type"
                  >
                    <SelectValue placeholder="Vælg boligtype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="lejlighed">Lejlighed</SelectItem>
                    <SelectItem value="andelsbolig">Andelsbolig</SelectItem>
                    <SelectItem value="rækkehus">Rækkehus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-full items-center gap-3">
                <Checkbox
                  checked={form.watch("hasCar") || false}
                  onCheckedChange={(checked) => form.setValue("hasCar", !!checked)}
                  className="w-6 h-6"
                  data-testid="checkbox-has-car"
                />
                <span className="text-body-bold font-body-bold text-default-font">
                  Har du bil?
                </span>
              </div>

              <div className="w-full">
                <label className="text-label font-label text-default-font mb-1 block">Ønsket selvrisiko</label>
                <Select 
                  onValueChange={(value) => form.setValue("deductible", value)} 
                  value={form.watch("deductible") || ""}
                >
                  <SelectTrigger 
                    className="w-full"
                    data-testid="select-deductible"
                  >
                    <SelectValue placeholder="Vælg selvrisiko" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2500">2.500 kr.</SelectItem>
                    <SelectItem value="5000">5.000 kr.</SelectItem>
                    <SelectItem value="7500">7.500 kr.</SelectItem>
                    <SelectItem value="10000">10.000 kr.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TextField
                className="h-auto w-full flex-none"
                label="Yderligere oplysninger"
                helpText="Fortæl os om eventuelle specielle krav eller behov (valgfrit)"
              >
                <TextField.Input
                  placeholder="Skriv din besked her..."
                  value={form.watch("additionalInfo") || ""}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    form.setValue("additionalInfo", event.target.value);
                  }}
                  data-testid="textarea-additional-info"
                />
              </TextField>

              <div className="flex w-full items-center justify-between pt-4">
                <LinkButton
                  icon={<FeatherArrowLeft />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => handlePrevious()}
                  data-testid="button-previous"
                >
                  Tilbage
                </LinkButton>
                <Button
                  iconRight={<FeatherArrowRight />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    form.handleSubmit(onUserInfoSubmit)();
                  }}
                  data-testid="button-next-user-info"
                >
                  Næste trin
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Company Selection */}
          {currentStep === 3 && (
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex flex-col items-start gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font">
                  Vælg forsikringsselskaber
                </span>
                <span className="text-body font-body text-subtext-color">
                  Vælg hvilke selskaber du vil anmode om tilbud fra
                </span>
              </div>

              <div className="flex w-full flex-col items-start gap-3">
                {(companies as any[]).map((company: any) => (
                  <div 
                    key={company.id}
                    className="flex w-full items-center gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6 hover:bg-neutral-50 cursor-pointer transition-colors"
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

              <div className="flex w-full items-center gap-4 rounded-md bg-brand-50 px-6 py-4">
                <IconWithBackground 
                  size="small" 
                  icon={<FeatherCheck />} 
                  variant="brand"
                />
                <div className="flex grow shrink-0 basis-0 flex-col items-start">
                  <span className="text-body-bold font-body-bold text-brand-700">
                    Personlig forespørgsel til hver
                  </span>
                  <span className="text-body font-body text-brand-700">
                    Vores AI genererer en skræddersyet forespørgsel til hvert selskab baseret på dine oplysninger
                  </span>
                </div>
              </div>

              <div className="flex w-full items-center justify-between pt-4">
                <LinkButton
                  icon={<FeatherArrowLeft />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => handlePrevious()}
                  data-testid="button-previous-companies"
                >
                  Tilbage
                </LinkButton>
                <Button
                  disabled={sendInquiriesMutation.isPending || selectedCompanies.length === 0}
                  iconRight={<FeatherSend />}
                  onClick={(event: React.MouseEvent<HTMLButtonElement>) => handleSendInquiries()}
                  data-testid="button-send-inquiries"
                >
                  Send forespørgsler
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DefaultPageLayout>
  );
}
