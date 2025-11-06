import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, clearCSRFToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SubframeProgress } from "@/components/wizard/SubframeProgress";
import { SubframeStep1 } from "@/components/wizard/SubframeStep1";
import { SubframeStep2 } from "@/components/wizard/SubframeStep2";
import { SubframeStep3 } from "@/components/wizard/SubframeStep3";
import type { OnboardingProgress, User } from "@shared/schema";

export default function LandingWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadSkipped, setUploadSkipped] = useState(false);

  const { data: progress } = useQuery<OnboardingProgress>({
    queryKey: ['/api/onboarding/progress', email],
    enabled: !!email,
    retry: false
  });

  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.currentStep as 1 | 2 | 3);
      if (progress.userId) setUserId(progress.userId);
      if (progress.documentId) setDocumentId(progress.documentId);
    }
  }, [progress]);

  const createProgressMutation = useMutation({
    mutationFn: async (email: string) => 
      apiRequest('POST', '/api/onboarding/progress', { email, currentStep: 1, completedSteps: [] }),
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke oprette session",
        variant: "destructive"
      });
    }
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: Partial<OnboardingProgress>) => 
      apiRequest('PUT', `/api/onboarding/progress/${email}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress', email] });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (email: string) => 
      apiRequest('POST', '/api/users', { email }),
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke oprette bruger",
        variant: "destructive"
      });
    }
  });

  const handleStep1Complete = async (userEmail: string) => {
    setEmail(userEmail);

    try {
      const existingProgress = await queryClient.fetchQuery<OnboardingProgress>({
        queryKey: ['/api/onboarding/progress', userEmail],
        queryFn: async () => {
          const response = await fetch(`/api/onboarding/progress/${userEmail}`, {
            credentials: 'include'
          });
          if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Kunne ikke hente fremskridt');
          }
          return response.json();
        },
        retry: false
      });

      if (existingProgress) {
        setCurrentStep(existingProgress.currentStep as 1 | 2 | 3);
        if (existingProgress.userId) {
          setUserId(existingProgress.userId);
          localStorage.setItem("userId", existingProgress.userId);
        }
        if (existingProgress.documentId) setDocumentId(existingProgress.documentId);
        return;
      }

      await createProgressMutation.mutateAsync(userEmail);

      const response = await createUserMutation.mutateAsync(userEmail);
      const user = await response.json() as User;
      setUserId(user.id);
      localStorage.setItem("userId", user.id);
      clearCSRFToken();

      await updateProgressMutation.mutateAsync({
        userId: user.id,
        completedSteps: [1],
        currentStep: 2
      });

      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error in step 1:', error);
    }
  };

  const handleStep2Complete = async (docId: string | null, skipped: boolean) => {
    setDocumentId(docId);
    setUploadSkipped(skipped);

    try {
      await updateProgressMutation.mutateAsync({
        documentId: docId,
        completedSteps: [1, 2],
        currentStep: 3
      });

      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error in step 2:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke gemme fremskridt",
        variant: "destructive"
      });
    }
  };

  const sendInquiriesMutation = useMutation({
    mutationFn: async (data: { 
      userId: string; 
      companyIds: string[]; 
      documentId: string | null;
    }) => {
      const response = await apiRequest('POST', '/api/send-inquiries', data);
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende forespørgsler",
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { name: string; cpr: string; priority: string }) =>
      apiRequest('PUT', `/api/users/${userId}`, {
        name: data.name,
        personalIdNumber: data.cpr,
        insurancePriority: data.priority
      })
  });

  const handleStep3Complete = async (data: {
    selectedCompanyIds: string[];
    name: string;
    cpr: string;
    priority: string;
  }) => {
    try {
      await updateProgressMutation.mutateAsync({
        selectedCompanyIds: data.selectedCompanyIds,
        name: data.name,
        cpr: data.cpr,
        priority: data.priority,
        completedSteps: [1, 2, 3],
        currentStep: 3
      });

      await updateUserMutation.mutateAsync({
        name: data.name,
        cpr: data.cpr,
        priority: data.priority
      });

      await sendInquiriesMutation.mutateAsync({
        userId,
        companyIds: data.selectedCompanyIds,
        documentId
      });

      toast({
        title: "Succes!",
        description: `Forespørgsler sendt til ${data.selectedCompanyIds.length} forsikringsselskab${data.selectedCompanyIds.length !== 1 ? 'er' : ''}`,
      });

      setTimeout(() => {
        setLocation('/offers');
      }, 1000);
    } catch (error: any) {
      console.error('Error in step 3:', error);
    }
  };

  const completedSteps = (progress?.completedSteps as number[]) || [];

  const isStep1Loading = createProgressMutation.isPending || createUserMutation.isPending;
  const isStep2Loading = updateProgressMutation.isPending;
  const isStep3Loading = updateProgressMutation.isPending || updateUserMutation.isPending || sendInquiriesMutation.isPending;

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center bg-default-background min-h-screen">
      <div className="flex w-full flex-col items-center gap-12">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-6 py-4">
          <span className="text-body-bold font-body-bold text-default-font">
            Bedretilbud.com
          </span>
          <span className="text-body font-body text-subtext-color">
            Få bedre tilbud på under 2 minutter
          </span>
        </div>

        <div className="flex w-full max-w-[768px] flex-col items-start gap-8 px-4">
          <SubframeProgress currentStep={currentStep} completedSteps={completedSteps} />

          {currentStep === 1 && (
            <SubframeStep1 onComplete={handleStep1Complete} isLoading={isStep1Loading} />
          )}

          {currentStep === 2 && (
            <SubframeStep2 
              onComplete={handleStep2Complete} 
              onBack={handleBack}
              isLoading={isStep2Loading} 
            />
          )}

          {currentStep === 3 && (
            <SubframeStep3 
              onComplete={handleStep3Complete} 
              onBack={handleBack}
              isLoading={isStep3Loading}
              uploadSkipped={uploadSkipped}
            />
          )}
        </div>
      </div>
    </div>
  );
}
