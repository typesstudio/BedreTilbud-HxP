import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, clearCSRFToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { OnboardingProgress, User } from "@shared/schema";

export function useWizardFlow() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadSkipped, setUploadSkipped] = useState(false);
  const [isProcessingStep1, setIsProcessingStep1] = useState(false);

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
    console.log('[Step1] Starting with email:', userEmail);
    setEmail(userEmail);
    setIsProcessingStep1(true);

    try {
      console.log('[Step1] Checking if user exists...');
      const checkResponse = await fetch(`/api/users/check/${encodeURIComponent(userEmail)}`, {
        credentials: 'include'
      });

      if (checkResponse.ok) {
        const { exists, user } = await checkResponse.json();
        
        if (exists && user) {
          console.log('[Step1] User exists - logging in...');
          setUserId(user.id);
          localStorage.setItem("userId", user.id);
          
          toast({
            title: "Velkommen tilbage!",
            description: "Du er nu logget ind",
          });
          
          setTimeout(() => {
            setLocation('/offers');
          }, 500);
          return;
        }
      }

      console.log('[Step1] New user - starting onboarding...');

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
      console.error('[Step1] Error occurred:', error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke fortsætte. Prøv venligst igen.",
        variant: "destructive"
      });
    } finally {
      console.log('[Step1] Finally block - clearing loading state');
      setIsProcessingStep1(false);
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
      const response = await apiRequest('POST', '/api/emails/send-inquiries', data);
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
      }),
  });

  const handleStep3Complete = async (
    companyIds: string[],
    name: string,
    cpr: string,
    priority: string
  ) => {
    try {
      await updateUserMutation.mutateAsync({ name, cpr, priority });

      await updateProgressMutation.mutateAsync({
        selectedCompanyIds: companyIds,
        name,
        cpr,
        priority,
        completedSteps: [1, 2, 3],
        currentStep: 3
      });

      const result = await sendInquiriesMutation.mutateAsync({
        userId,
        companyIds,
        documentId
      });

      toast({
        title: "Forespørgsler sendt!",
        description: `Vi har sendt forespørgsler til ${result.successfulCompanies?.length || companyIds.length} forsikringsselskaber`,
      });

      setTimeout(() => {
        setLocation('/offers');
      }, 1000);
    } catch (error: any) {
      console.error('Error in step 3:', error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende forespørgsler",
        variant: "destructive"
      });
    }
  };

  return {
    currentStep,
    email,
    userId,
    documentId,
    uploadSkipped,
    isProcessingStep1,
    handleStep1Complete,
    handleStep2Complete,
    handleStep3Complete,
  };
}
