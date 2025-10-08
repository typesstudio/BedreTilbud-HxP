import { useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, ArrowLeft, ArrowRight, Send } from "lucide-react";
import ProgressSteps from "@/components/progress-steps";
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

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserInfoForm) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: (user) => {
      setUserId(user.id);
      localStorage.setItem("userId", user.id);
      toast({
        title: "Bruger oprettet",
        description: "Dine oplysninger er gemt",
      });
    },
  });

  // Upload documents mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("userId", userId!);
      formData.append("documentType", "current");

      const response = await apiRequest("POST", "/api/documents/upload", formData);
      return response.json();
    },
    onSuccess: (documents) => {
      setUploadedFiles(documents);
      toast({
        title: "Filer uploadet",
        description: `${documents.length} dokumenter er uploadet og behandlet`,
      });
    },
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
      setLocation("/offers");
    },
  });

  const handleNext = useCallback(() => {
    if (currentStep < 4) {
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

  const onUserInfoSubmit = (data: UserInfoForm) => {
    if (userId) {
      // Update existing user
      apiRequest("PUT", `/api/users/${userId}`, data)
        .then(() => {
          toast({
            title: "Oplysninger opdateret",
            description: "Dine oplysninger er gemt",
          });
          handleNext();
        })
        .catch((error) => {
          toast({
            title: "Fejl",
            description: "Kunne ikke gemme oplysninger",
            variant: "destructive",
          });
        });
    } else {
      createUserMutation.mutate(data);
      handleNext();
    }
  };

  const handleFilesUploaded = (files: FileList) => {
    if (userId) {
      uploadMutation.mutate(files);
    } else {
      toast({
        title: "Fejl",
        description: "Du skal først udfylde dine oplysninger",
        variant: "destructive",
      });
    }
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
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <ProgressSteps
              currentStep={currentStep}
              steps={[
                "Upload dokumenter",
                "Dine oplysninger", 
                "Vælg selskaber",
                "Modtag tilbud"
              ]}
            />

            {/* Step 1: Upload Documents */}
            {currentStep === 1 && (
              <Card className="shadow-card-lg">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-foreground mb-3">
                      Upload dine nuværende forsikringer
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Upload PDF-dokumenter fra dine eksisterende forsikringer, så vi kan finde dig bedre tilbud
                    </p>
                  </div>

                  <FileUpload
                    onFilesUploaded={handleFilesUploaded}
                    uploadedFiles={uploadedFiles}
                    isUploading={uploadMutation.isPending}
                  />

                  <div className="flex justify-end mt-8">
                    <Button
                      onClick={handleNext}
                      disabled={uploadedFiles.length === 0}
                      size="lg"
                      className="text-lg px-12 py-4"
                      data-testid="button-next-step"
                    >
                      Næste trin
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: User Information */}
            {currentStep === 2 && (
              <Card className="shadow-card-lg">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-foreground mb-3">
                      Fortæl os om dig selv
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Disse oplysninger hjælper os med at finde de bedste tilbud til dig
                    </p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onUserInfoSubmit)} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                E-mail *
                              </FormLabel>
                              <FormControl>
                                <input
                                  {...field}
                                  type="email"
                                  className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring focus:outline-none"
                                  placeholder="din@email.dk"
                                  data-testid="input-email"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                Navn
                              </FormLabel>
                              <FormControl>
                                <input
                                  {...field}
                                  type="text"
                                  className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring focus:outline-none"
                                  placeholder="Dit navn"
                                  data-testid="input-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="housingType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                Boligtype
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring"
                                    data-testid="select-housing-type"
                                  >
                                    <SelectValue placeholder="Vælg boligtype" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="villa">Villa</SelectItem>
                                  <SelectItem value="lejlighed">Lejlighed</SelectItem>
                                  <SelectItem value="andelsbolig">Andelsbolig</SelectItem>
                                  <SelectItem value="rækkehus">Rækkehus</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hasCar"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="w-6 h-6"
                                  data-testid="checkbox-has-car"
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                Har du bil?
                              </FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="deductible"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                Ønsket selvrisiko
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring"
                                    data-testid="select-deductible"
                                  >
                                    <SelectValue placeholder="Vælg selvrisiko" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="2500">2.500 kr.</SelectItem>
                                  <SelectItem value="5000">5.000 kr.</SelectItem>
                                  <SelectItem value="7500">7.500 kr.</SelectItem>
                                  <SelectItem value="10000">10.000 kr.</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">
                                Alder
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger 
                                    className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring"
                                    data-testid="select-age"
                                  >
                                    <SelectValue placeholder="Vælg aldersgruppe" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="under-30">Under 30</SelectItem>
                                  <SelectItem value="30-40">30-40</SelectItem>
                                  <SelectItem value="40-50">40-50</SelectItem>
                                  <SelectItem value="50-60">50-60</SelectItem>
                                  <SelectItem value="over-60">Over 60</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="additionalInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-foreground">
                              Yderligere oplysninger (valgfrit)
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={5}
                                className="w-full px-4 py-3 border-2 border-input rounded-lg bg-background text-foreground text-base focus:border-ring focus:outline-none resize-none"
                                placeholder="Er der noget særligt, vi skal vide? F.eks. ønsker om specifikke dækninger..."
                                data-testid="textarea-additional-info"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="bg-muted rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-foreground mb-1">
                              Sådan bruger vi dine oplysninger
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Vi bruger disse oplysninger til at skabe personlige forespørgsler til 
                              forsikringsselskaber. Dine data deles kun med de selskaber, du vælger.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <Button 
                          type="button"
                          onClick={handlePrevious}
                          variant="outline"
                          size="lg"
                          className="px-8 py-4 text-lg"
                          data-testid="button-previous"
                        >
                          <ArrowLeft className="mr-2 w-5 h-5" />
                          Tilbage
                        </Button>
                        <Button
                          type="submit"
                          disabled={createUserMutation.isPending}
                          size="lg"
                          className="px-12 py-4 text-lg"
                          data-testid="button-next-user-info"
                        >
                          Næste trin
                          <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Company Selection */}
            {currentStep === 3 && (
              <Card className="shadow-card-lg">
                <CardContent className="p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-foreground mb-3">
                      Vælg forsikringsselskaber
                    </h2>
                    <p className="text-lg text-muted-foreground">
                      Vælg hvilke selskaber du vil anmode om tilbud fra
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    {companies.map((company: any) => (
                      <label
                        key={company.id}
                        className="flex items-center gap-4 p-6 border-2 border-border rounded-xl hover:border-primary cursor-pointer transition-colors bg-background"
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
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">
                              {company.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-foreground">
                              {company.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {company.description}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="bg-accent/10 border-2 border-accent/30 rounded-lg p-6 mb-8">
                    <div className="flex items-start gap-4">
                      <Shield className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Personlig forespørgsel sendes til hver
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Vores AI genererer en personlig forespørgsel baseret på dine oplysninger og 
                          nuværende forsikringer til hvert selskab.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button
                      onClick={handlePrevious}
                      variant="outline"
                      size="lg"
                      className="px-8 py-4 text-lg"
                      data-testid="button-previous-companies"
                    >
                      <ArrowLeft className="mr-2 w-5 h-5" />
                      Tilbage
                    </Button>
                    <Button
                      onClick={handleSendInquiries}
                      disabled={sendInquiriesMutation.isPending || selectedCompanies.length === 0}
                      size="lg"
                      className="px-12 py-4 text-lg"
                      data-testid="button-send-inquiries"
                    >
                      <Send className="mr-2 w-5 h-5" />
                      Send forespørgsler
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
