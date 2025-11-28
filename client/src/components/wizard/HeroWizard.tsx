import { useCallback } from "react";
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
import { useWizardFlow, type WizardStep } from "@/hooks/useWizardFlow";

interface HeroWizardProps {
  onComplete?: () => void;
  onStepChange?: (step: WizardStep) => void;
}

interface Company {
  id: string;
  name: string;
  description?: string;
}

export function HeroWizard({ onComplete, onStepChange }: HeroWizardProps) {
  const { toast } = useToast();
  
  const {
    currentStep,
    email,
    setEmail,
    name,
    setName,
    cpr,
    setCpr,
    preference,
    setPreference,
    selectedCompanies,
    setSelectedCompanies,
    showResumeBanner,
    isProcessingStep1,
    handleStep1Complete,
    handleStep2Complete,
    handleStep3Complete,
    handleStep4Complete,
    goToStep,
    handleResume,
    handleStartFresh,
  } = useWizardFlow();

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await handleStep1Complete(email);
    onStepChange?.(2);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('[Upload] onDrop triggered with files:', acceptedFiles.length);
    const file = acceptedFiles[0];
    if (!file) {
      console.log('[Upload] No file in acceptedFiles');
      return;
    }
    console.log('[Upload] Processing file:', file.name, file.type, file.size);

    const formData = new FormData();
    formData.append('files', file);
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast({ title: "Fejl", description: 'Bruger ID mangler', variant: "destructive" });
      return;
    }
    
    formData.append('userId', userId);
    formData.append('documentType', 'current');

    try {
      console.log('[Upload] Sending upload request...');
      const response = await apiRequest('POST', '/api/documents/upload', formData);
      console.log('[Upload] Response received:', response.status);
      const result = await response.json();
      console.log('[Upload] Result:', result);
      const documents = Array.isArray(result) ? result : [result];
      
      toast({ title: "Succes!", description: "Police uploaded - vi analyserer den i baggrunden" });
      console.log('[Upload] Calling handleStep2Complete with docId:', documents[0]?.id);
      
      await handleStep2Complete(documents[0]?.id || null, false);
      console.log('[Upload] Step 2 complete, transitioning to step 3');
      onStepChange?.(3);
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      toast({ title: "Fejl", description: error.message || 'Upload fejlede', variant: "destructive" });
    }
  }, [handleStep2Complete, onStepChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1
  });

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await handleStep3Complete(name, cpr, preference);
    onStepChange?.(4);
  };

  const handleCompaniesSubmit = async () => {
    if (selectedCompanies.length === 0) {
      toast({ title: "Vælg mindst ét selskab", variant: "destructive" });
      return;
    }
    await handleStep4Complete(selectedCompanies);
    onComplete?.();
  };

  const toggleCompany = (companyId: string) => {
    setSelectedCompanies((prev: string[]) => 
      prev.includes(companyId) 
        ? prev.filter((id: string) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const selectAllCompanies = () => {
    setSelectedCompanies(companies.map(c => c.id));
  };

  const formatCpr = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length > 6) {
      return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    return digits;
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-lg border border-brand-200 bg-brand-50 px-6 py-4 shadow-lg" data-testid="banner-resume">
          <span className="text-body-bold font-body-bold text-brand-700">
            Vil du fortsætte hvor du slap?
          </span>
          <Button variant="brand-primary" size="small" onClick={handleResume} data-testid="button-resume">
            Fortsæt
          </Button>
          <Button variant="neutral-secondary" size="small" onClick={handleStartFresh} data-testid="button-start-fresh">
            Start forfra
          </Button>
        </div>
      )}

      <div className="flex min-h-[576px] w-full flex-col items-center justify-center gap-16 px-4 pt-16 pb-32 bg-gradient-to-br from-brand-50 via-white to-neutral-50">
        <div className="flex w-full max-w-[576px] flex-col items-center gap-8">
          <div className="flex items-center gap-1 rounded-md border border-solid border-brand-200 bg-brand-50 pl-3 pr-2 py-1">
            <span className="whitespace-nowrap text-body font-body text-brand-700">
              {stepLabels[currentStep]}
            </span>
            <FeatherTimer className="text-body font-body text-brand-700" />
          </div>

          {currentStep === 1 && (
            <Step1Email 
              email={email} 
              setEmail={setEmail} 
              onSubmit={handleEmailSubmit} 
              isLoading={isProcessingStep1} 
            />
          )}
          {currentStep === 2 && (
            <Step2Upload 
              getRootProps={getRootProps} 
              getInputProps={getInputProps} 
              isDragActive={isDragActive}
              onBack={() => goToStep(1)}
            />
          )}
          {currentStep === 3 && (
            <Step3Info 
              name={name} 
              setName={setName}
              cpr={cpr} 
              setCpr={(val) => setCpr(formatCpr(val))}
              preference={preference} 
              setPreference={setPreference}
              onSubmit={handleInfoSubmit}
              onBack={() => goToStep(2)}
              isLoading={false}
            />
          )}
          {currentStep === 4 && (
            <Step4Companies
              companies={companies}
              selectedCompanies={selectedCompanies}
              toggleCompany={toggleCompany}
              selectAllCompanies={selectAllCompanies}
              onSubmit={handleCompaniesSubmit}
              onBack={() => goToStep(3)}
              isLoading={false}
            />
          )}
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
        <span className="w-full text-heading-1 font-heading-1 text-default-font text-center">
          Stop med at betale for meget
        </span>
        <span className="w-full text-body font-body text-subtext-color text-center max-w-[480px]">
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

function Step2Upload({ getRootProps, getInputProps, isDragActive, onBack }: {
  getRootProps: any;
  getInputProps: any;
  isDragActive: boolean;
  onBack: () => void;
}) {
  console.log('[Step2Upload] Rendering, isDragActive:', isDragActive);
  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full text-heading-1 font-heading-1 text-default-font text-center">
          Upload din forsikringspolice
        </span>
        <span className="w-full text-body font-body text-subtext-color text-center max-w-[480px]">
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
              isDragActive ? 'border-brand-600 bg-brand-50' : 'border-brand-600 bg-neutral-50 hover:bg-brand-50'
            }`}
          >
            <input {...getInputProps()} data-testid="input-file-upload" />
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-600">
              <FeatherUploadCloud className="text-body font-body text-white" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-heading-3 font-heading-3 text-default-font text-center">
                Klik for at uploade din police
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
            <Button variant="neutral-secondary" icon={<FeatherArrowLeft />} onClick={onBack} data-testid="button-back-step2">
              Tilbage
            </Button>
            <span className="text-caption font-caption text-subtext-color">Trin 2 af 4</span>
            <div className="w-[100px]" />
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
  return (
    <>
      <div className="flex w-full flex-col items-center gap-4">
        <span className="w-full text-heading-1 font-heading-1 text-default-font text-center">
          Dine informationer
        </span>
        <span className="w-full text-body font-body text-subtext-color text-center max-w-[480px]">
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
            label="CPR-nummer (valgfrit)" 
            helpText="Bruges til identifikation hos forsikringsselskaber"
            icon={<FeatherCreditCard />}
          >
            <TextField.Input
              data-testid="input-cpr"
              placeholder="XXXXXX-XXXX"
              value={cpr}
              onChange={(e) => setCpr(e.target.value)}
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

          <div className="flex w-full items-center justify-between">
            <Button variant="neutral-secondary" icon={<FeatherArrowLeft />} onClick={onBack} type="button" data-testid="button-back-step3">
              Tilbage
            </Button>
            <span className="text-caption font-caption text-subtext-color">Trin 3 af 4</span>
            <Button
              data-testid="button-continue-info"
              variant="variation"
              type="submit"
              iconRight={<FeatherArrowRight />}
              disabled={isLoading || !name}
              loading={isLoading}
            >
              Fortsæt
            </Button>
          </div>

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
        <span className="w-full text-heading-1 font-heading-1 text-default-font text-center">
          Vælg forsikringsselskaber
        </span>
        <span className="w-full text-body font-body text-subtext-color text-center max-w-[480px]">
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
              data-testid="button-select-all"
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

          <div className="flex w-full items-center justify-between">
            <Button variant="neutral-secondary" icon={<FeatherArrowLeft />} onClick={onBack} data-testid="button-back-step4">
              Tilbage
            </Button>
            <span className="text-caption font-caption text-subtext-color">Trin 4 af 4</span>
            <Button
              data-testid="button-complete"
              variant="variation"
              icon={<FeatherCheckCircle />}
              onClick={onSubmit}
              disabled={isLoading || selectedCompanies.length === 0}
              loading={isLoading}
            >
              Fortsæt ({selectedCompanies.length})
            </Button>
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
              <span className="text-caption font-caption text-subtext-color">Svar inden 1-3 dage</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
