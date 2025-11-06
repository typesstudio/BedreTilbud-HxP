import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, CheckCircle, Eye, Percent, MessageCircle, Upload, Loader2 } from "lucide-react";
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
      <div className="flex min-h-screen w-full flex-col items-center bg-background">
        <div className="flex w-full flex-col items-center gap-12">
          <div className="flex w-full items-center justify-between border-b px-6 py-4">
            <span className="text-lg font-bold">Bedretilbud.com</span>
            <span className="text-sm text-muted-foreground">
              Få bedre tilbud på under 2 minutter
            </span>
          </div>

          <div className="flex w-full max-w-[768px] flex-col items-start gap-8 px-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="rounded-full px-3 py-1">
                  <Check className="mr-1 h-4 w-4" />
                  Din Email
                </Badge>
              </div>
              <div className="h-px w-20 bg-border" />
              <div className="flex items-center gap-2">
                <Badge variant={currentStep >= 2 ? "default" : "secondary"} className="rounded-full px-3 py-1">
                  <Upload className="mr-1 h-4 w-4" />
                  Upload
                </Badge>
              </div>
              <div className="h-px w-20 bg-border" />
              <div className="flex items-center gap-2">
                <Badge variant={currentStep >= 3 ? "default" : "secondary"} className="rounded-full px-3 py-1">
                  <CheckCircle className="mr-1 h-4 w-4" />
                  Vælg
                </Badge>
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
    <div className="flex min-h-screen w-full flex-col items-center bg-background">
      <div className="flex w-full flex-col items-center gap-16">
        <div className="flex w-full items-center justify-between border-b px-6 py-4">
          <span className="text-lg font-bold">Bedretilbud.com</span>
          <span className="text-sm font-semibold text-primary">
            Få bedre tilbud på under 2 minutter
          </span>
        </div>
        
        <div className="flex w-full max-w-[768px] flex-col items-center gap-12 px-4 pt-8">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="rounded-full px-3 py-1">
                <Check className="mr-1 h-4 w-4" />
                Din Email
              </Badge>
            </div>
            <div className="h-px w-20 bg-border" />
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                <Upload className="mr-1 h-4 w-4" />
                Upload Police
              </Badge>
            </div>
            <div className="h-px w-20 bg-border" />
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                <CheckCircle className="mr-1 h-4 w-4" />
                Vælg Selskaber
              </Badge>
            </div>
          </div>
          
          <div className="flex w-full flex-col items-center gap-8">
            <div className="flex w-full flex-col items-center gap-4 text-center">
              <h1 className="text-5xl font-bold leading-tight">
                Få bedre forsikringer
              </h1>
              <p className="text-lg text-muted-foreground">
                Upload dine nuværende aftaler én gang.<br />
                Vi henter nye tilbud, sammenligner side om side
              </p>
            </div>
            
            <form onSubmit={handleEmailSubmit} className="flex w-full max-w-[448px] flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email adresse</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@email.dk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  data-testid="input-email"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full text-base"
                disabled={isProcessingStep1 || !email}
                data-testid="button-continue"
              >
                {isProcessingStep1 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vent venligst...
                  </>
                ) : (
                  "Få bedre tilbud"
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="grid w-full max-w-[1024px] grid-cols-1 gap-8 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">Ingen telefonkøer</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Alt klares online, uden app eller glemte kodeord, kun din email
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <span className="font-semibold">Side-om-side overblik</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Dækning, pris, selvrisiko og udelukkelser på én skærm
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              <span className="font-semibold">Simpel forklaring</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Vi oversætter jura og gebyrer til klart dansk
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              <span className="font-semibold">Pris-pres</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Vi bruger de billigste tilbud til at presse konkurrenter
            </p>
          </div>
        </div>

        <div className="w-full bg-gradient-to-b from-transparent via-muted/20 to-transparent">
          <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-12 px-6 py-16">
            <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-end">
              <h2 className="text-4xl font-bold leading-tight lg:flex-1">
                Sådan får du<br />bedre forsikringer
              </h2>
              <p className="text-lg text-muted-foreground lg:flex-1">
                Vi tager os af alt det besværlige. Upload din police én gang, så
                sørger vi for at du altid har de bedste tilbud.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <img
                  className="h-48 w-full object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724705412/uploads/302/rc9vp0qjfzzptopfssad.png"
                  alt="Upload policer"
                />
                <div className="flex items-center justify-between p-6">
                  <span className="text-lg font-medium">
                    Upload dine policer, tager kun 2 minutter
                  </span>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <img
                  className="h-48 w-full object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724690142/uploads/302/fbkapcq4o1zsq98df0t6.png"
                  alt="Vi forhandler"
                />
                <div className="flex items-center justify-between p-6">
                  <span className="text-lg font-medium">
                    Vi forhandler med selskaberne for dig
                  </span>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <img
                  className="h-48 w-full object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724690087/uploads/302/w2ra2yihpofsdy1h4uhy.png"
                  alt="Godkend og spar"
                />
                <div className="flex items-center justify-between p-6">
                  <span className="text-lg font-medium">
                    Du godkender og begynder at spare
                  </span>
                  <Check className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-[768px] flex-col items-center gap-4 px-6 py-20 text-center">
          <p className="text-xl">
            Du spilder tid i telefonkøer. Du taler med sælgere. Du mister
            overblikket.
          </p>
          <p className="text-xl font-medium text-muted-foreground">
            Vi forhandler for dig, viser klart overblik og holder dig på Bedre
            Tilbud
          </p>
        </div>
      </div>
    </div>
  );
}
