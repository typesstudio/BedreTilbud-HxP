import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, clearCSRFToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { OnboardingProgress, User } from "@shared/schema";

export type WizardStep = 1 | 2 | 3 | 4;

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

const STORAGE_KEY = 'bt_onboarding_session';

interface LocalSession {
  step: WizardStep;
  email: string;
  userId: string;
  documentId: string | null;
  name: string;
  cpr: string;
  preference: 'cheapest' | 'coverage' | 'convenience';
  selectedCompanies: string[];
}

export function useWizardFlow() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadSkipped, setUploadSkipped] = useState(false);
  const [isProcessingStep1, setIsProcessingStep1] = useState(false);
  const [name, setName] = useState<string>('');
  const [cpr, setCpr] = useState<string>('');
  const [preference, setPreference] = useState<'cheapest' | 'coverage' | 'convenience'>('cheapest');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [savedStep, setSavedStep] = useState<WizardStep | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadFileName, setUploadFileName] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session: LocalSession = JSON.parse(saved);
        if (session.step && session.step > 1) {
          setShowResumeBanner(true);
          setSavedStep(session.step);
          setEmail(session.email || "");
          setUserId(session.userId || "");
          setDocumentId(session.documentId);
          setName(session.name || "");
          setPreference(session.preference || 'cheapest');
          setSelectedCompanies(session.selectedCompanies || []);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveSession = useCallback(() => {
    const session: LocalSession = {
      step: currentStep,
      email,
      userId,
      documentId,
      name,
      cpr: '',
      preference,
      selectedCompanies
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [currentStep, email, userId, documentId, name, preference, selectedCompanies]);

  useEffect(() => {
    if (currentStep > 1 && email) {
      saveSession();
    }
  }, [currentStep, saveSession, email]);

  const { data: progress } = useQuery<OnboardingProgress>({
    queryKey: ['/api/onboarding/progress', email],
    enabled: !!email,
    retry: false
  });

  useEffect(() => {
    if (progress) {
      const step = progress.currentStep as WizardStep;
      if (step >= 1 && step <= 4) {
        setCurrentStep(step);
      }
      if (progress.userId) setUserId(progress.userId);
      if (progress.documentId) setDocumentId(progress.documentId);
      if (progress.name) setName(progress.name);
      if (progress.priority) setPreference(progress.priority as any);
      if (progress.selectedCompanyIds) setSelectedCompanies(progress.selectedCompanyIds);
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
          console.log('[Step1] Returning user detected');
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

  const startBackgroundUpload = useCallback(async (file: File): Promise<string | null> => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('Bruger ID mangler');
    }

    setUploadStatus('uploading');
    setUploadFileName(file.name);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('files', file);
    formData.append('userId', userId);
    formData.append('documentType', 'current');

    try {
      setUploadProgress(30);
      console.log('[BackgroundUpload] Starting upload for:', file.name);
      
      const response = await apiRequest('POST', '/api/documents/upload', formData);
      setUploadProgress(70);
      setUploadStatus('processing');
      
      const result = await response.json();
      const documents = Array.isArray(result) ? result : [result];
      const docId = documents[0]?.id || null;
      
      console.log('[BackgroundUpload] Upload complete, docId:', docId);
      setUploadProgress(100);
      setUploadStatus('complete');
      setDocumentId(docId);
      
      await updateProgressMutation.mutateAsync({
        documentId: docId,
        completedSteps: [1, 2],
        currentStep: 3
      });
      
      toast({
        title: "Upload færdig!",
        description: "Din police er modtaget og bliver analyseret",
      });
      
      return docId;
    } catch (error: any) {
      console.error('[BackgroundUpload] Error:', error);
      setUploadStatus('error');
      toast({
        title: "Upload fejlede",
        description: error.message || "Prøv venligst igen",
        variant: "destructive"
      });
      throw error;
    }
  }, [updateProgressMutation, toast]);

  const handleStep2Complete = async (docId: string | null, skipped: boolean, file?: File) => {
    setUploadSkipped(skipped);
    
    if (file && !skipped) {
      setUploadStatus('uploading');
      setUploadFileName(file.name);
      setCurrentStep(3);
      
      startBackgroundUpload(file).catch((error) => {
        console.error('[Step2] Background upload failed:', error);
      });
    } else {
      setDocumentId(docId);
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
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: { name: string; cpr: string; priority: string }) =>
      apiRequest('PUT', `/api/users/${userId}`, {
        name: data.name,
        personalIdNumber: data.cpr,
        insurancePriority: data.priority
      }),
  });

  const handleStep3Complete = async (userName: string, userCpr: string, userPreference: 'cheapest' | 'coverage' | 'convenience') => {
    setName(userName);
    setCpr(userCpr);
    setPreference(userPreference);

    try {
      await updateUserMutation.mutateAsync({ name: userName, cpr: userCpr, priority: userPreference });

      await updateProgressMutation.mutateAsync({
        name: userName,
        cpr: userCpr,
        priority: userPreference,
        completedSteps: [1, 2, 3],
        currentStep: 4
      });

      setCurrentStep(4);
    } catch (error: any) {
      console.error('Error in step 3:', error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke gemme dine oplysninger",
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

  const handleStep4Complete = async (companyIds: string[]) => {
    setSelectedCompanies(companyIds);

    try {
      await updateProgressMutation.mutateAsync({
        selectedCompanyIds: companyIds,
        completedSteps: [1, 2, 3, 4],
        currentStep: 4
      });

      const result = await sendInquiriesMutation.mutateAsync({
        userId,
        companyIds,
        documentId
      });

      localStorage.removeItem(STORAGE_KEY);

      if (result.isDraft) {
        toast({
          title: "Forespørgsler oprettet",
          description: `Dine forespørgsler til ${companyIds.length} selskaber afventer godkendelse fra administrator.`,
        });
      } else {
        toast({
          title: "Forespørgsler sendt!",
          description: `Vi har sendt forespørgsler til ${result.successfulCompanies?.length || companyIds.length} forsikringsselskaber`,
        });
      }

      setTimeout(() => {
        setLocation('/offers');
      }, 1000);
    } catch (error: any) {
      console.error('Error in step 4:', error);
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende forespørgsler",
        variant: "destructive"
      });
    }
  };

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    saveSession();
  };

  const handleResume = () => {
    if (savedStep) {
      setCurrentStep(savedStep);
    }
    setShowResumeBanner(false);
  };

  const handleStartFresh = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowResumeBanner(false);
    setEmail("");
    setUserId("");
    setDocumentId(null);
    setName("");
    setCpr("");
    setPreference('cheapest');
    setSelectedCompanies([]);
    setCurrentStep(1);
  };

  return {
    currentStep,
    email,
    setEmail,
    userId,
    documentId,
    uploadSkipped,
    isProcessingStep1,
    name,
    setName,
    cpr,
    setCpr,
    preference,
    setPreference,
    selectedCompanies,
    setSelectedCompanies,
    showResumeBanner,
    uploadStatus,
    uploadProgress,
    uploadFileName,
    handleStep1Complete,
    handleStep2Complete,
    handleStep3Complete,
    handleStep4Complete,
    goToStep,
    handleResume,
    handleStartFresh,
  };
}
