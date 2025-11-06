import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { FeatherArrowRight, FeatherCheck, FeatherCheckCircle, FeatherEye, FeatherPercent, FeatherSpeech, FeatherTypeOutline, FeatherUpload } from "@subframe/core";
import { useWizardFlow } from "@/hooks/useWizardFlow";
import { SubframeStep2 } from "@/components/wizard/SubframeStep2";
import { SubframeStep3 } from "@/components/wizard/SubframeStep3";
import { useState } from "react";

export default function ModernLandingPage() {
  const {
    currentStep,
    isProcessingStep1,
    handleStep1Complete,
    handleStep2Complete,
    handleStep3Complete
  } = useWizardFlow();

  const [email, setEmail] = useState("");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      handleStep1Complete(email);
    }
  };

  if (currentStep > 1) {
    return (
      <div className="flex h-full w-full flex-col items-center bg-default-background">
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
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <IconWithBackground variant="success" icon={<FeatherCheck />} />
                <span className="text-body-bold font-body-bold text-success-600">
                  Din Email
                </span>
              </div>
              <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
              <div className="flex items-center gap-2">
                <IconWithBackground 
                  variant={currentStep >= 2 ? "brand" : "neutral"} 
                  icon={<FeatherUpload />} 
                />
                <span className={`text-body font-body ${currentStep >= 2 ? 'text-brand-600 font-bold' : 'text-subtext-color'}`}>
                  Upload Police
                </span>
              </div>
              <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
              <div className="flex items-center gap-2">
                <IconWithBackground
                  variant={currentStep >= 3 ? "brand" : "neutral"}
                  icon={<FeatherCheckCircle />}
                />
                <span className={`text-body font-body ${currentStep >= 3 ? 'text-brand-600 font-bold' : 'text-subtext-color'}`}>
                  Vælg Selskaber
                </span>
              </div>
            </div>

            {currentStep === 2 && (
              <SubframeStep2 
                onComplete={handleStep2Complete} 
                onBack={() => {}}
                isLoading={false} 
              />
            )}

            {currentStep === 3 && (
              <SubframeStep3 
                onComplete={(data) => handleStep3Complete(
                  data.selectedCompanyIds,
                  data.name,
                  data.cpr,
                  data.priority
                )} 
                onBack={() => {}}
                isLoading={false}
                uploadSkipped={false}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center bg-default-background">
      <div className="flex w-full flex-col items-center gap-12">
        <div className="flex w-full items-center justify-between border-b border-solid border-neutral-border px-2 py-2">
          <span className="text-body-bold font-body-bold text-default-font">
            Bedretilbud.com
          </span>
          <span className="text-body-bold font-body-bold text-brand-600">
            Få bedre tilbud på under 2 minutter
          </span>
        </div>
        
        <div className="flex w-full max-w-[768px] flex-col items-start gap-8 pt-12">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <IconWithBackground />
              <span className="text-body-bold font-body-bold text-brand-600">
                Din Email
              </span>
            </div>
            <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
            <div className="flex items-center gap-2">
              <IconWithBackground variant="neutral" icon={<FeatherUpload />} />
              <span className="text-body font-body text-subtext-color">
                Upload Police
              </span>
            </div>
            <div className="flex h-px w-24 flex-none items-center bg-neutral-200" />
            <div className="flex items-center gap-2">
              <IconWithBackground
                variant="neutral"
                icon={<FeatherCheckCircle />}
              />
              <span className="text-body font-body text-subtext-color">
                Få Bedre Tilbud
              </span>
            </div>
          </div>
          
          <div className="flex w-full flex-col items-center gap-6">
            <div className="flex w-full flex-col items-center gap-2">
              <span className="font-['Inter_Tight'] text-[56px] font-[600] leading-[56px] text-default-font text-center">
                Få bedre forsikringer
              </span>
              <span className="whitespace-pre-wrap text-body font-body text-subtext-color text-center">
                {
                  "Upload dine nuværende aftaler én gang. \nVi henter nye tilbud, sammenligner side om side"
                }
              </span>
            </div>
            
            <form onSubmit={handleEmailSubmit} className="flex w-full max-w-[448px] flex-col items-start gap-6">
              <TextField
                className="h-auto w-full flex-none"
                label="Email adresse"
                helpText=""
              >
                <TextField.Input
                  placeholder="din@email.dk"
                  value={email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                  data-testid="input-email"
                />
              </TextField>
              <Button
                className="h-10 w-full flex-none"
                variant="variation"
                size="large"
                type="submit"
                disabled={isProcessingStep1 || !email}
                loading={isProcessingStep1}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                data-testid="button-continue"
              >
                {isProcessingStep1 ? "Vent venligst..." : "Få bedre tilbud"}
              </Button>
            </form>
          </div>
        </div>

        <div className="flex w-full max-w-[1024px] flex-wrap items-center gap-12 py-16">
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherSpeech className="font-['Inter'] text-[16px] font-[400] leading-[16px] text-default-font" />
              <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-default-font -tracking-[0.01em]">
                Ingen telefonkøer
              </span>
            </div>
            <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-subtext-color -tracking-[0.01em]">
              Alt klares online, uden app, eller glemte kodeord, kun din email
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherEye className="font-['Inter'] text-[16px] font-[400] leading-[16px] text-default-font" />
              <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-default-font -tracking-[0.01em]">
                Side-om-side overblik
              </span>
            </div>
            <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-subtext-color -tracking-[0.01em]">
              Dækning, pris, selvrisiko og udelukkelser på én skærm
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherTypeOutline className="font-['Inter'] text-[16px] font-[400] leading-[16px] text-default-font" />
              <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-default-font -tracking-[0.01em]">
                Simpel forklaring
              </span>
            </div>
            <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-subtext-color -tracking-[0.01em]">
              Vi oversætter jura og gebyrer til klart dansk simpelt og nemt
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherPercent className="font-['Inter'] text-[16px] font-[400] leading-[16px] text-default-font" />
              <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-default-font -tracking-[0.01em]">
                Pris-pres
              </span>
            </div>
            <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-subtext-color -tracking-[0.01em]">
              Vi bruger de billigste tilbud til at presse konkurrenter.
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center px-6 pt-12 bg-gradient-to-b from-transparent via-neutral-100 to-transparent">
          <div className="flex w-full max-w-[1024px] flex-col items-start gap-16">
            <div className="flex w-full items-end gap-12 flex-wrap">
              <span className="grow shrink-0 basis-0 whitespace-pre-wrap font-['Inter'] text-[56px] font-[600] leading-[62px] text-default-font -tracking-[0.04em]">
                {"Sådan får du\nbedre forsikringer"}
              </span>
              <span className="grow shrink-0 basis-0 font-['Inter'] text-[17px] font-[500] leading-[24px] text-subtext-color -tracking-[0.01em]">
                Vi tager os af alt det besværlige. Upload din police én gang, så
                sørger vi for at du altid har de bedste tilbud.
              </span>
            </div>
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                <img
                  className="h-64 w-full flex-none object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724705412/uploads/302/rc9vp0qjfzzptopfssad.png"
                  alt="Upload policer"
                />
                <div className="flex w-full grow shrink-0 basis-0 items-end gap-2 bg-default-background px-8 py-6">
                  <span className="grow shrink-0 basis-0 font-['Inter'] text-[21px] font-[500] leading-[28px] text-default-font -tracking-[0.02em]">
                    Upload dine policer, tager kun 2 minutter
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherArrowRight />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  />
                </div>
              </div>
              <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                <img
                  className="h-64 w-full flex-none object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724690142/uploads/302/fbkapcq4o1zsq98df0t6.png"
                  alt="Vi forhandler"
                />
                <div className="flex w-full grow shrink-0 basis-0 items-end gap-2 bg-default-background px-8 py-6">
                  <span className="grow shrink-0 basis-0 font-['Inter'] text-[21px] font-[500] leading-[28px] text-default-font -tracking-[0.02em]">
                    Vi forhandler med selskaberne for dig
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherArrowRight />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  />
                </div>
              </div>
              <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                <img
                  className="h-64 w-full flex-none object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724690087/uploads/302/w2ra2yihpofsdy1h4uhy.png"
                  alt="Godkend og spar"
                />
                <div className="flex w-full grow shrink-0 basis-0 items-end gap-2 bg-default-background px-8 py-6">
                  <span className="grow shrink-0 basis-0 font-['Inter'] text-[21px] font-[500] leading-[28px] text-default-font -tracking-[0.02em]">
                    Du godkender og begynder at spare
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherCheck />}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {}}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-12 px-6 py-24">
          <div className="flex w-full max-w-[1024px] flex-col items-center justify-center gap-12">
            <div className="flex w-full max-w-[768px] flex-col items-center gap-1">
              <span className="font-['Inter'] text-[21px] font-[500] leading-[28px] text-default-font -tracking-[0.03em] text-center">
                Du spilder tid i telefonkøer. Du taler med sælgere. Du mister
                overblikket.
              </span>
              <span className="font-['Inter'] text-[23px] font-[500] leading-[28px] text-subtext-color -tracking-[0.03em] text-center">
                Vi forhandler for dig, viser klart overblik og holder dig på Bedre
                Tilbud
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
