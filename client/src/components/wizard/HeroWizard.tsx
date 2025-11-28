import { useState, useEffect, useCallback } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { CheckboxCard } from "@/ui/components/CheckboxCard";
import { ToggleGroup } from "@/ui/components/ToggleGroup";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { 
  FeatherArrowRight, 
  FeatherArrowLeft,
  FeatherCheckCircle,
  FeatherTimer,
  FeatherSparkles,
  FeatherUploadCloud,
  FeatherLogIn,
  FeatherCoins,
  FeatherUsers,
  FeatherUser,
  FeatherCreditCard,
  FeatherDollarSign,
  FeatherShield,
  FeatherPackage,
  FeatherZap,
  FeatherBuilding,
  FeatherCheckSquare,
  FeatherBell,
  FeatherHelpCircle
} from "@subframe/core";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export type WizardStep = 1 | 2 | 3 | 4;

interface HeroWizardProps {
  onComplete: (data: OnboardingData) => void;
  onStepChange?: (step: WizardStep) => void;
}

interface OnboardingData {
  email: string;
  documentId: string | null;
  name: string;
  cpr: string;
  preference: 'cheapest' | 'coverage' | 'convenience';
  selectedCompanyIds: string[];
}

interface Company {
  id: string;
  name: string;
  description?: string;
}

const STORAGE_KEY = 'bt_onboarding_session';

export function HeroWizard({ onComplete, onStepChange }: HeroWizardProps) {
  const { toast } = useToast();
  
  const [step, setStep] = useState<WizardStep>(1);
  const [email, setEmail] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cpr, setCpr] = useState("");
  const [preference, setPreference] = useState<'cheapest' | 'coverage' | 'convenience'>('cheapest');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.step && session.step > 1) {
          setShowResumeBanner(true);
          setSessionId(session.sessionId);
          setEmail(session.email || "");
          setDocumentId(session.documentId);
          setName(session.name || "");
          setCpr(session.cpr || "");
          setPreference(session.preference || 'cheapest');
          setSelectedCompanies(session.selectedCompanies || []);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveSession = useCallback((currentStep: WizardStep) => {
    const session = {
      sessionId,
      step: currentStep,
      email,
      documentId,
      name,
      cpr,
      preference,
      selectedCompanies
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [sessionId, email, documentId, name, cpr, preference, selectedCompanies]);

  const goToStep = (newStep: WizardStep) => {
    setStep(newStep);
    saveSession(newStep);
    onStepChange?.(newStep);
  };

  const handleResume = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      setStep(session.step as WizardStep);
    }
    setShowResumeBanner(false);
  };

  const handleStartFresh = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowResumeBanner(false);
    setEmail("");
    setDocumentId(null);
    setName("");
    setCpr("");
    setPreference('cheapest');
    setSelectedCompanies([]);
    setStep(1);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    try {
      const checkResponse = await fetch(`/api/users/check/${encodeURIComponent(email)}`, {
        credentials: 'include'
      });
      
      if (checkResponse.ok) {
        const { exists, user } = await checkResponse.json();
        if (exists && user) {
          localStorage.setItem("userId", user.id);
          toast({ title: "Velkommen tilbage!", description: "Du er nu logget ind" });
          window.location.href = '/offers';
          return;
        }
      }

      const progressResponse = await apiRequest('POST', '/api/onboarding/progress', { 
        email, 
        currentStep: 1, 
        completedSteps: [] 
      });
      
      const userResponse = await apiRequest('POST', '/api/users', { email });
      const user = await userResponse.json();
      localStorage.setItem("userId", user.id);
      setSessionId(user.id);

      await apiRequest('PUT', `/api/onboarding/progress/${email}`, {
        userId: user.id,
        completedSteps: [1],
        currentStep: 2
      });

      goToStep(2);
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke fortsætte",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('files', file);
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setUploadStatus('error');
      toast({ title: "Fejl", description: 'Bruger ID mangler', variant: "destructive" });
      return;
    }
    
    formData.append('userId', userId);
    formData.append('documentType', 'current');

    try {
      const response = await apiRequest('POST', '/api/documents/upload', formData);
      const result = await response.json();
      const documents = Array.isArray(result) ? result : [result];
      setDocumentId(documents[0]?.id || null);
      setUploadStatus('success');
      
      toast({ title: "Succes!", description: "Police uploaded - vi analyserer den i baggrunden" });

      await apiRequest('PUT', `/api/onboarding/progress/${email}`, {
        documentId: documents[0]?.id,
        completedSteps: [1, 2],
        currentStep: 3
      });
    } catch (error: any) {
      setUploadStatus('error');
      toast({ title: "Fejl", description: error.message || 'Upload fejlede', variant: "destructive" });
    }
  }, [email, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
    disabled: uploadStatus === 'uploading' || uploadStatus === 'success' || isLoading
  });

  const handleStep2Continue = async () => {
    goToStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsLoading(true);
    try {
      await apiRequest('PUT', `/api/onboarding/progress/${email}`, {
        name,
        cpr,
        priority: preference,
        completedSteps: [1, 2, 3],
        currentStep: 4
      });
      goToStep(4);
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep4Submit = async () => {
    if (selectedCompanies.length === 0) {
      toast({ title: "Vælg mindst ét selskab", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('PUT', `/api/onboarding/progress/${email}`, {
        selectedCompanyIds: selectedCompanies,
        completedSteps: [1, 2, 3, 4],
        currentStep: 4
      });

      localStorage.removeItem(STORAGE_KEY);
      
      onComplete({
        email,
        documentId,
        name,
        cpr,
        preference,
        selectedCompanyIds: selectedCompanies
      });
    } catch (error: any) {
      toast({ title: "Fejl", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const selectAllCompanies = () => {
    setSelectedCompanies(companies.map(c => c.id));
  };

  const stepLabels: Record<WizardStep, string> = {
    1: "Tager kun 2 minutter",
    2: "Tager kun 2 minutter", 
    3: "Sidste trin",
    4: "Sidste trin"
  };

  return (
    <div className="flex w-full flex-col items-center">
      {showResumeBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-lg border border-brand-200 bg-brand-50 px-6 py-4 shadow-lg">
          <span className="text-body-bold font-body-bold text-brand-700">
            Vil du fortsætte hvor du slap?
          </span>
          <Button variant="brand-primary" size="small" onClick={handleResume}>
            Fortsæt
          </Button>
          <Button variant="neutral-secondary" size="small" onClick={handleStartFresh}>
            Start forfra
          </Button>
        </div>
      )}

      <div className="flex min-h-[576px] w-full flex-col items-center justify-center gap-16 px-4 pt-16 pb-32 bg-gradient-to-br from-brand-50 via-white to-neutral-50">
        <div className="flex w-full max-w-[576px] flex-col items-center gap-8">
          <div className="flex items-center gap-1 rounded-md border border-solid border-brand-200 bg-brand-50 pl-3 pr-2 py-1">
            <span className="whitespace-nowrap font-['Inter'] text-[14px] font-[500] leading-[20px] text-brand-700">
              {stepLabels[step]}
            </span>
            <FeatherTimer className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-brand-700" />
          </div>

          {step === 1 && <Step1Email email={email} setEmail={setEmail} onSubmit={handleStep1Submit} isLoading={isLoading} />}
          {step === 2 && <Step2Upload 
            getRootProps={getRootProps} 
            getInputProps={getInputProps} 
            isDragActive={isDragActive}
            uploadStatus={uploadStatus}
            onContinue={handleStep2Continue}
            onBack={() => goToStep(1)}
          />}
          {step === 3 && <Step3Info 
            name={name} setName={setName}
            cpr={cpr} setCpr={setCpr}
            preference={preference} setPreference={setPreference}
            onSubmit={handleStep3Submit}
            onBack={() => goToStep(2)}
            isLoading={isLoading}
          />}
          {step === 4 && <Step4Companies
            companies={companies}
            selectedCompanies={selectedCompanies}
            toggleCompany={toggleCompany}
            selectAllCompanies={selectAllCompanies}
            onSubmit={handleStep4Submit}
            onBack={() => goToStep(3)}
            isLoading={isLoading}
          />}
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <img className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" alt="" />
              <img className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover -ml-2" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" alt="" />
              <img className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover -ml-2" src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop" alt="" />
            </div>
            <span className="text-body font-body text-subtext-color">
              12.400+ danskere har allerede sparet
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step1Email({ email, setEmail, onSubmit, isLoading }: {
  email: string;
  setEmail: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}) {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full font-['Inter'] text-[48px] sm:text-[64px] font-[600] leading-[52px] sm:leading-[68px] text-default-font text-center -tracking-[0.04em]">
          Stop med at betale for meget
        </span>
        <span className="w-full font-['Inter'] text-[18px] sm:text-[20px] font-[500] leading-[26px] sm:leading-[28px] text-subtext-color text-center -tracking-[0.02em]">
          Vi forhandler automatisk med forsikringsselskaber på dine vegne. Upload din police og spar uden besvær.
        </span>
      </div>
      
      <form onSubmit={onSubmit} className="flex w-full max-w-[576px] items-center gap-2 rounded-md border border-solid border-neutral-200 bg-white px-2 py-2 shadow-lg">
        <TextField className="h-auto grow shrink-0 basis-0" label="" helpText="">
          <TextField.Input
            data-testid="input-email"
            placeholder="din@email.dk"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </TextField>
        <Button
          data-testid="button-start"
          variant="variation"
          size="large"
          type="submit"
          iconRight={<FeatherArrowRight />}
          disabled={isLoading || !email}
          loading={isLoading}
        >
          Få bedre tilbud
        </Button>
      </form>
    </>
  );
}

function Step2Upload({ getRootProps, getInputProps, isDragActive, uploadStatus, onContinue, onBack }: {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full font-['Inter'] text-[48px] sm:text-[64px] font-[600] leading-[52px] sm:leading-[68px] text-default-font text-center -tracking-[0.04em]">
          Upload din forsikringspolice
        </span>
        <span className="w-full font-['Inter'] text-[18px] sm:text-[20px] font-[500] leading-[26px] sm:leading-[28px] text-subtext-color text-center -tracking-[0.02em]">
          Vi analyserer automatisk og finder bedre tilbud fra alle forsikringsselskaber
        </span>
      </div>

      <div className="flex w-full max-w-[768px] flex-col items-start overflow-hidden rounded-xl border border-solid border-neutral-border bg-white shadow-lg">
        <div className="flex w-full items-center gap-4 bg-brand-50 px-6 py-4">
          <FeatherCoins className="text-heading-2 font-heading-2 text-brand-600" />
          <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
            <span className="text-body-bold font-body-bold text-default-font">Martin Jensen</span>
            <span className="text-caption font-caption text-subtext-color">Sparede 4.200 kr på bilforsikring · Fandt bedre tilbud på 2 dage</span>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-6 px-6 py-6">
          <div 
            {...getRootProps()} 
            className={`flex w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-8 py-12 cursor-pointer transition-all ${
              isDragActive ? 'border-brand-600 bg-brand-50' : 
              uploadStatus === 'success' ? 'border-success-600 bg-success-50' :
              uploadStatus === 'error' ? 'border-error-600 bg-error-50' :
              'border-brand-600 bg-neutral-50 hover:bg-brand-50'
            }`}
          >
            <input {...getInputProps()} data-testid="input-file-upload" />
            <div className={`flex h-16 w-16 flex-none items-center justify-center rounded-full ${
              uploadStatus === 'success' ? 'bg-success-600' : 
              uploadStatus === 'error' ? 'bg-error-600' : 
              'bg-brand-600'
            }`}>
              {uploadStatus === 'success' ? (
                <FeatherCheckCircle className="text-body font-body text-white" />
              ) : (
                <FeatherUploadCloud className="text-body font-body text-white" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-heading-3 font-heading-3 text-default-font text-center">
                {uploadStatus === 'uploading' ? 'Uploader...' :
                 uploadStatus === 'success' ? 'Police uploaded!' :
                 uploadStatus === 'error' ? 'Prøv igen' :
                 'Klik for at uploade din police'}
              </span>
              <span className="text-body font-body text-subtext-color text-center">
                PDF, JPG eller PNG - maks 10MB
              </span>
            </div>
          </div>

          <div className="flex w-full items-start gap-4 flex-wrap">
            <div className="flex min-w-[240px] grow shrink-0 basis-0 items-start gap-4 rounded-lg border border-solid border-brand-200 bg-brand-50 px-6 py-6">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-600">
                <FeatherLogIn className="text-body font-body text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <span className="text-body-bold font-body-bold text-default-font">Log ind og download</span>
                <span className="text-caption font-caption text-subtext-color">Log ind på dit forsikringsselskab og download din police som PDF</span>
              </div>
            </div>
            <div className="flex min-w-[240px] grow shrink-0 basis-0 items-start gap-4 rounded-lg border border-solid border-brand-200 bg-brand-50 px-6 py-6">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-600">
                <FeatherUploadCloud className="text-body font-body text-white" />
              </div>
              <div className="flex grow shrink-0 basis-0 flex-col items-start gap-2">
                <span className="text-body-bold font-body-bold text-default-font">Upload din police</span>
                <span className="text-caption font-caption text-subtext-color">Upload filen her og vi giver dig et forsikringstjek og finder bedre priser</span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex w-full items-center gap-2">
              <FeatherCheckCircle className="text-body font-body text-brand-600" />
              <span className="text-body-bold font-body-bold text-brand-700">
                Du får et gratis forsikringstjek når du uploader
              </span>
            </div>
          </div>

          <div className="flex w-full items-center justify-between">
            <Button variant="neutral-secondary" icon={<FeatherArrowLeft />} onClick={onBack}>
              Tilbage
            </Button>
            <span className="text-caption font-caption text-subtext-color">Trin 2 af 4</span>
            <Button 
              data-testid="button-continue-upload"
              variant="variation" 
              iconRight={<FeatherArrowRight />} 
              onClick={onContinue}
              disabled={uploadStatus !== 'success'}
            >
              Find bedre tilbud
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <FeatherCheckCircle className="text-body font-body text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Ingen skjulte gebyrer</span>
            </div>
            <div className="flex items-center gap-2">
              <FeatherCheckCircle className="text-body font-body text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Ingen binding</span>
            </div>
            <div className="flex items-center gap-2">
              <FeatherCheckCircle className="text-body font-body text-success-600" />
              <span className="text-caption font-caption text-subtext-color">100% gratis at bruge</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Step3Info({ name, setName, cpr, setCpr, preference, setPreference, onSubmit, onBack, isLoading }: {
  name: string;
  setName: (name: string) => void;
  cpr: string;
  setCpr: (cpr: string) => void;
  preference: 'cheapest' | 'coverage' | 'convenience';
  setPreference: (pref: 'cheapest' | 'coverage' | 'convenience') => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const formatCpr = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length > 6) {
      return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    return digits;
  };

  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full font-['Inter'] text-[48px] sm:text-[64px] font-[600] leading-[52px] sm:leading-[68px] text-default-font text-center -tracking-[0.04em]">
          Dine informationer
        </span>
        <span className="w-full font-['Inter'] text-[18px] sm:text-[20px] font-[500] leading-[26px] sm:leading-[28px] text-subtext-color text-center -tracking-[0.02em]">
          Vi har brug for lidt information for at kunne indhente de bedste tilbud til dig
        </span>
      </div>

      <form onSubmit={onSubmit} className="flex w-full max-w-[768px] flex-col items-start overflow-hidden rounded-xl border border-solid border-neutral-border bg-white shadow-lg">
        <div className="flex w-full items-center gap-4 bg-brand-50 px-6 py-4">
          <FeatherUsers className="text-heading-2 font-heading-2 text-brand-600" />
          <div className="flex grow shrink-0 basis-0 flex-col items-start">
            <span className="text-body-bold font-body-bold text-default-font">Lige nu får 263 danskere bedre tilbud</span>
            <span className="text-caption font-caption text-subtext-color">Gennemsnitlig besparelse er over 3.200 kr om måneden</span>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-6 py-6">
          <TextField className="h-auto w-full flex-none" label="Navn" helpText="" icon={<FeatherUser />}>
            <TextField.Input
              data-testid="input-name"
              placeholder="Dit fulde navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </TextField>

          <TextField 
            className="h-auto w-full flex-none" 
            label="CPR-nummer" 
            helpText="Bruges til identifikation hos forsikringsselskaber"
            icon={<FeatherCreditCard />}
          >
            <TextField.Input
              data-testid="input-cpr"
              placeholder="XXXXXX-XXXX"
              value={cpr}
              onChange={(e) => setCpr(formatCpr(e.target.value))}
              disabled={isLoading}
            />
          </TextField>

          <div className="flex w-full flex-col items-start gap-2">
            <div className="flex w-full items-center gap-2">
              <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                Hvad søger du?
              </span>
              <FeatherHelpCircle className="text-body font-body text-subtext-color" />
            </div>
            <ToggleGroup
              className="h-auto w-full flex-none"
              value={preference}
              onValueChange={(value) => setPreference(value as any)}
            >
              <ToggleGroup.Item icon={<FeatherDollarSign />} value="cheapest">
                Den billigste
              </ToggleGroup.Item>
              <ToggleGroup.Item icon={<FeatherShield />} value="coverage">
                Bedst Dækning
              </ToggleGroup.Item>
              <ToggleGroup.Item icon={<FeatherPackage />} value="convenience">
                Samlet et sted
              </ToggleGroup.Item>
            </ToggleGroup>
          </div>

          <Button
            data-testid="button-continue-info"
            className="h-10 w-full flex-none"
            variant="variation"
            size="large"
            type="submit"
            icon={<FeatherCheckCircle />}
            disabled={isLoading || !name}
            loading={isLoading}
          >
            Få dine personlige tilbud
          </Button>

          <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex w-full items-center gap-2">
              <FeatherZap className="text-body font-body text-brand-600" />
              <span className="text-body-bold font-body-bold text-brand-700">
                Du får bedre tilbud inden for 1-3 hverdage
              </span>
            </div>
          </div>

          <div className="flex w-full items-center justify-center gap-6">
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Gratis</span>
            </div>
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Ingen binding</span>
            </div>
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Ingen gebyrer</span>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

function Step4Companies({ companies, selectedCompanies, toggleCompany, selectAllCompanies, onSubmit, onBack, isLoading }: {
  companies: Company[];
  selectedCompanies: string[];
  toggleCompany: (id: string) => void;
  selectAllCompanies: () => void;
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const defaultCompanies: Company[] = companies.length > 0 ? companies : [
    { id: 'tryg', name: 'Tryg Forsikring', description: 'Danmarks største forsikringsselskab' },
    { id: 'almbrand', name: 'Alm. Brand', description: 'Kendt for god kundeservice' },
    { id: 'privatsikring', name: 'Privatsikring', description: 'Specialister i privatforsikring' },
  ];

  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full font-['Inter'] text-[48px] sm:text-[64px] font-[600] leading-[52px] sm:leading-[68px] text-default-font text-center -tracking-[0.04em]">
          Vælg forsikringsselskaber
        </span>
        <span className="w-full font-['Inter'] text-[18px] sm:text-[20px] font-[500] leading-[26px] sm:leading-[28px] text-subtext-color text-center -tracking-[0.02em]">
          Vælg hvilke forsikringsselskaber du vil have tilbud fra
        </span>
      </div>

      <div className="flex w-full max-w-[768px] flex-col items-start overflow-hidden rounded-xl border border-solid border-neutral-border bg-white shadow-lg">
        <div className="flex w-full items-center gap-4 bg-brand-50 px-6 py-4">
          <FeatherBuilding className="text-heading-2 font-heading-2 text-brand-600" />
          <div className="flex grow shrink-0 basis-0 flex-col items-start">
            <span className="text-body-bold font-body-bold text-default-font">Vi gør arbejdet for dig</span>
            <span className="text-caption font-caption text-subtext-color">Spar tid - vi kontakter selskaberne og forhandler automatisk</span>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-6 px-6 py-6">
          <div className="flex w-full items-center justify-between">
            <span className="text-body-bold font-body-bold text-default-font">Vælg forsikringsselskaber</span>
            <Button
              variant="neutral-secondary"
              size="small"
              icon={<FeatherCheckSquare />}
              onClick={selectAllCompanies}
            >
              Vælg alle
            </Button>
          </div>

          <div className="flex w-full flex-col items-start gap-3">
            {defaultCompanies.map((company) => (
              <CheckboxCard
                key={company.id}
                className="h-auto w-full flex-none"
                checked={selectedCompanies.includes(company.id)}
                onCheckedChange={() => toggleCompany(company.id)}
                data-testid={`checkbox-company-${company.id}`}
              >
                <div className="flex grow shrink-0 basis-0 items-center gap-4">
                  <IconWithBackground
                    variant={selectedCompanies.includes(company.id) ? "brand" : "neutral"}
                    size="large"
                    icon={<FeatherShield />}
                    square={true}
                  />
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">{company.name}</span>
                    <span className="text-caption font-caption text-subtext-color">{company.description}</span>
                  </div>
                </div>
              </CheckboxCard>
            ))}
          </div>

          <div className="flex w-full flex-col items-start gap-3 rounded-lg border border-solid border-brand-200 bg-brand-50 px-4 py-3">
            <div className="flex w-full items-center gap-2">
              <FeatherBell className="text-body font-body text-brand-600" />
              <span className="text-body-bold font-body-bold text-brand-700">
                Læn dig tilbage - vi kontakter dig
              </span>
            </div>
            <span className="text-caption font-caption text-subtext-color">
              Vi holder øje med markedet og kontakter dig automatisk når der er et nyt tilbud tilgængeligt
            </span>
          </div>

          <Button
            data-testid="button-complete"
            className="h-10 w-full flex-none"
            variant="variation"
            size="large"
            icon={<FeatherCheckCircle />}
            onClick={onSubmit}
            disabled={isLoading || selectedCompanies.length === 0}
            loading={isLoading}
          >
            Fortsæt med {selectedCompanies.length} valgte selskaber
          </Button>

          <div className="flex w-full items-center justify-center gap-6">
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Gratis</span>
            </div>
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Ingen binding</span>
            </div>
            <div className="flex items-center gap-1">
              <FeatherCheckCircle className="text-caption font-caption text-success-600" />
              <span className="text-caption font-caption text-subtext-color">Svar inden 1-3 dage</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
