import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { LinkButton } from "@/ui/components/LinkButton";
import { Button } from "@/ui/components/Button";
import { 
  FeatherArrowRight, 
  FeatherCheck, 
  FeatherChevronRight,
  FeatherEye, 
  FeatherPercent, 
  FeatherSpeech, 
  FeatherTypeOutline
} from "@subframe/core";
import { HeroWizard } from "@/components/wizard/HeroWizard";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function ModernLandingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleWizardComplete = (data: {
    email: string;
    documentId: string | null;
    name: string;
    cpr: string;
    preference: 'cheapest' | 'coverage' | 'convenience';
    selectedCompanyIds: string[];
  }) => {
    toast({
      title: "Tak for din tilmelding!",
      description: "Vi analyserer dine policer og kontakter dig snart med bedre tilbud.",
    });
    setLocation('/offers');
  };

  return (
    <div className="flex h-full w-full flex-col items-center bg-default-background">
      <div className="flex w-full flex-col items-center relative">
        {/* Navigation Header - Floating on top of hero */}
        <div className="absolute top-4 left-0 right-0 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-[1024px] items-center justify-between rounded-lg border border-solid border-neutral-200 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-sm">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Bedretilbud.com
            </span>
            <div className="hidden md:flex items-center gap-8">
              <LinkButton onClick={() => {}}>
                Få bedre tilbud
              </LinkButton>
              <LinkButton onClick={() => {}}>
                Sådan virker det
              </LinkButton>
              <LinkButton onClick={() => {}}>
                Kontakt
              </LinkButton>
            </div>
            <div className="flex items-center gap-4">
              <LinkButton onClick={() => setLocation('/login')}>
                Log ind
              </LinkButton>
              <Button onClick={() => {
                const heroElement = document.querySelector('[data-testid="input-email"]');
                heroElement?.scrollIntoView({ behavior: 'smooth' });
                (heroElement as HTMLInputElement)?.focus();
              }}>
                Kom i gang
              </Button>
            </div>
          </div>
        </div>

        {/* Hero Section with 4-Step Wizard */}
        <HeroWizard onComplete={handleWizardComplete} />

        {/* Features Grid */}
        <div className="flex w-full max-w-[1024px] flex-wrap items-center gap-12 py-16 px-4">
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherSpeech className="w-4 h-4 text-default-font" />
              <span className="text-body-bold font-body-bold text-default-font">
                Ingen telefonkøer
              </span>
            </div>
            <span className="text-body font-body text-subtext-color">
              Alt klares online, uden app, eller glemte kodeord, kun din email
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherEye className="w-4 h-4 text-default-font" />
              <span className="text-body-bold font-body-bold text-default-font">
                Side-om-side overblik
              </span>
            </div>
            <span className="text-body font-body text-subtext-color">
              Dækning, pris, selvrisiko og udelukkelser på én skærm
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherTypeOutline className="w-4 h-4 text-default-font" />
              <span className="text-body-bold font-body-bold text-default-font">
                Simpel forklaring
              </span>
            </div>
            <span className="text-body font-body text-subtext-color">
              Vi oversætter jura og gebyrer til klart dansk simpelt og nemt
            </span>
          </div>
          <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FeatherPercent className="w-4 h-4 text-default-font" />
              <span className="text-body-bold font-body-bold text-default-font">
                Pris-pres
              </span>
            </div>
            <span className="text-body font-body text-subtext-color">
              Vi bruger de billigste tilbud til at presse konkurrenter.
            </span>
          </div>
        </div>

        {/* How it Works Section */}
        <div className="flex w-full flex-col items-center justify-center px-6 pt-12 bg-gradient-to-b from-transparent via-neutral-100 to-transparent">
          <div className="flex w-full max-w-[1024px] flex-col items-start gap-16">
            <div className="flex w-full items-end gap-12 flex-wrap">
              <span className="grow shrink-0 basis-0 whitespace-pre-wrap text-[48px] md:text-[56px] font-semibold leading-tight text-default-font tracking-tight font-heading-1">
                {"Sådan får du\nbedre forsikringer"}
              </span>
              <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-subtext-color">
                Vi tager os af alt det besværlige. Upload din police én gang, så
                sørger vi for at du altid har bedre tilbud.
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
                  <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
                    Upload dine policer, tager kun 2 minutter
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherArrowRight />}
                    onClick={() => {}}
                    data-testid="button-how-it-works-upload"
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
                  <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
                    Vi forhandler med selskaberne for dig
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherArrowRight />}
                    onClick={() => {}}
                    data-testid="button-how-it-works-negotiate"
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
                  <span className="grow shrink-0 basis-0 text-heading-2 font-heading-2 text-default-font">
                    Du godkender og begynder at spare
                  </span>
                  <IconButton
                    size="large"
                    icon={<FeatherCheck />}
                    onClick={() => {}}
                    data-testid="button-how-it-works-approve"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Problem / Solution Statement */}
        <div className="flex w-full flex-col items-center justify-center gap-12 px-6 py-24">
          <div className="flex w-full max-w-[1024px] flex-col items-center justify-center gap-12">
            <div className="flex w-full max-w-[768px] flex-col items-center gap-1">
              <span className="text-heading-2 font-heading-2 text-default-font text-center">
                Du spilder tid i telefonkøer. Du taler med sælgere. Du mister
                overblikket.
              </span>
              <span className="text-heading-2 font-heading-2 text-subtext-color text-center">
                Vi forhandler for dig, viser klart overblik og holder dig på Bedre
                Tilbud
              </span>
            </div>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="flex w-full flex-col items-start justify-center gap-4 overflow-hidden">
          <div className="flex w-full flex-col items-center px-6 py-20 bg-gradient-to-b from-neutral-50 to-transparent">
            <div className="flex w-full flex-col items-center gap-16 px-12 pt-12 pb-20">
              <div className="flex w-full flex-col items-center gap-2">
                <span className="text-heading-1 font-heading-1 text-default-font text-center">
                  Vi har hjulpet rigtig mange danskere
                </span>
                <span className="text-body font-body text-subtext-color text-center">
                  Tusinder har allerede fundet bedre tilbud
                </span>
              </div>
              <div className="flex w-full items-start gap-6 flex-wrap">
                <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl border border-solid border-neutral-border bg-default-background px-8 py-8">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Martin Jensen
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Bilforsikring
                    </span>
                  </div>
                  <span className="text-body font-body text-default-font">
                    Jeg sparede 4.200 kr på min bilforsikring uden at miste noget
                    dækning. Det tog kun 2 minutter at uploade min police, og jeg
                    fik en bedretilbud på under en uge
                  </span>
                  <div className="flex items-center gap-2">
                    <IconWithBackground variant="success" size="small" />
                    <span className="text-body-bold font-body-bold text-success-600">
                      Sparede 4.200 kr/år
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl border border-solid border-neutral-border bg-default-background px-8 py-8">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Sofie Andersen
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Indboforsikring
                    </span>
                  </div>
                  <span className="text-body font-body text-default-font">
                    Efter at have brugt samme forsikringsselskab i 15 år, var det
                    en lettelse at få hjælp til at sammenligne. Jeg fandt et meget
                    bedre tilbud.
                  </span>
                  <div className="flex items-center gap-2">
                    <IconWithBackground variant="success" size="small" />
                    <span className="text-body-bold font-body-bold text-success-600">
                      Sparede 2.800 kr/år
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[288px] grow shrink-0 basis-0 flex-col items-start gap-6 rounded-2xl border border-solid border-neutral-border bg-default-background px-8 py-8">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-body-bold font-body-bold text-default-font">
                      Kasper Nielsen
                    </span>
                    <span className="text-body font-body text-subtext-color">
                      Husforsikring
                    </span>
                  </div>
                  <span className="text-body font-body text-default-font">
                    Jeg troede jeg havde en god pris, men Bedretilbud viste mig
                    skjulte gebyrer jeg ikke kendte til. Nu betaler jeg mindre for
                    mere, det er jeg glad for.
                  </span>
                  <div className="flex items-center gap-2">
                    <IconWithBackground variant="success" size="small" />
                    <span className="text-body-bold font-body-bold text-success-600">
                      Sparede 5.600 kr/år
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Klare sammenligninger Section */}
            <div className="flex w-full max-w-[1024px] flex-col items-start gap-6">
              <div className="flex w-full flex-col items-start gap-8">
                <div className="flex w-full flex-col items-start gap-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-2 w-4 flex-none flex-col items-start gap-2 rounded-full bg-brand-600" />
                    <span className="text-body-bold font-body-bold text-default-font">
                      Simpelt og hurtigt
                    </span>
                    <FeatherChevronRight className="text-body font-body text-default-font" />
                  </div>
                  <span className="w-full max-w-[768px] text-heading-1 font-heading-1 text-default-font">
                    Klare sammenligninger
                  </span>
                </div>
                <div className="flex w-full max-w-[448px] flex-col items-start">
                  <span className="w-full whitespace-pre-wrap text-body-bold font-body-bold text-default-font">
                    {"Ingen lange formularer eller besværlige processer"}
                  </span>
                  <span className="w-full whitespace-pre-wrap text-body font-body text-subtext-color">
                    {
                      "Se præcis hvad der er inkluderet, hvad det koster, og hvad forskellen er mellem tilbuddene - alt på én side."
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Screenshot */}
          <img
            className="max-h-[576px] w-full max-w-[1024px] flex-none"
            src="https://res.cloudinary.com/subframe/image/upload/v1724705485/uploads/302/lynkyfusi4ab4z91o69c.png"
            alt="Sammenligning"
          />

          {/* Vi forhandler for dig / Løbende overvågning */}
          <div className="flex w-full flex-col items-center px-6 pt-16">
            <div className="flex w-full max-w-[1024px] items-center justify-center border-t border-solid border-neutral-100 flex-wrap">
              <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-start gap-8 border-r border-solid border-neutral-100 pr-12 py-12">
                <div className="flex w-full flex-col items-start gap-1">
                  <span className="w-full text-heading-2 font-heading-2 text-default-font">
                    Vi forhandler for dig
                  </span>
                  <span className="w-full whitespace-pre-wrap text-body font-body text-subtext-color">
                    {
                      "Vi kontakter automatisk forsikringsselskaber, sammenligner tilbud og forhandler bedre priser."
                    }
                  </span>
                </div>
                <img
                  className="h-72 w-full max-w-[576px] flex-none object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724705499/uploads/302/jh06ubduyciizexxi4ep.png"
                  alt="Vi forhandler"
                />
              </div>
              <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-start gap-8 pl-12 py-12">
                <div className="flex w-full flex-col items-start gap-1">
                  <span className="w-full text-heading-2 font-heading-2 text-default-font">
                    Løbende overvågning
                  </span>
                  <span className="w-full whitespace-pre-wrap text-body font-body text-subtext-color">
                    {
                      "Vi tjekker kontinuerligt markedet for bedre tilbud, så du altid har den bedste forsikring til den laveste pris."
                    }
                  </span>
                </div>
                <img
                  className="h-72 w-full max-w-[576px] flex-none object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724705524/uploads/302/l5oq75rpdkq2kowa2xkj.png"
                  alt="Løbende overvågning"
                />
              </div>
            </div>

            {/* Bedre tilbud finder sig selv */}
            <div className="flex h-px w-full max-w-[1024px] flex-none flex-col items-center gap-2 bg-neutral-100" />
            <div className="flex w-full max-w-[1024px] items-center justify-center gap-6 border-b border-solid border-neutral-100 py-16 flex-wrap">
              <div className="flex min-w-[320px] grow shrink-0 basis-0 items-center gap-8">
                <div className="flex max-w-[384px] grow shrink-0 basis-0 flex-col items-start gap-6">
                  <span className="w-full whitespace-pre-wrap text-heading-2 font-heading-2 text-default-font">
                    {"Bedre tilbud finder sig selv"}
                  </span>
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-1 flex-none flex-col items-center justify-center gap-2 rounded-full bg-brand-600" />
                      <span className="whitespace-pre-wrap text-body-bold font-body-bold text-brand-700">
                        {"Vi overvåger priserne på markedet"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-1 flex-none flex-col items-center justify-center gap-2 rounded-full bg-neutral-300" />
                      <span className="whitespace-pre-wrap text-body font-body text-subtext-color">
                        {"Vi indhenter nye tilbud når priser ændres"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-1 flex-none flex-col items-center justify-center gap-2 rounded-full bg-neutral-300" />
                      <span className="whitespace-pre-wrap text-body font-body text-subtext-color">
                        {"Du får kun besked når der er et bedre tilbud"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex min-w-[320px] grow shrink-0 basis-0 items-center justify-center gap-6">
                <img
                  className="h-112 grow shrink-0 basis-0 object-cover"
                  src="https://res.cloudinary.com/subframe/image/upload/v1724690075/uploads/302/ajop7v0t3y1bjmf9obyp.png"
                  alt="Automatisk overvågning"
                />
              </div>
            </div>

            {/* Hvad får du med Bedretilbud? */}
            <div className="flex w-full flex-col items-center justify-center px-6 pt-40">
              <div className="flex w-full max-w-[1024px] flex-col items-center justify-center gap-16">
                <div className="flex w-full items-end gap-12 flex-wrap">
                  <div className="flex grow shrink-0 basis-0 flex-col items-start gap-6">
                    <div className="flex items-center gap-2">
                      <div className="flex h-2 w-4 flex-none flex-col items-start gap-2 rounded-full bg-success-400" />
                      <span className="text-body-bold font-body-bold text-default-font">
                        Styrken i samarbejde
                      </span>
                    </div>
                    <span className="w-full text-heading-1 font-heading-1 text-default-font">
                      Hvad får du med Bedretilbud?
                    </span>
                  </div>
                  <span className="grow shrink-0 basis-0 text-body font-body text-subtext-color">
                    Vi fokuserer på at give dig bedre priser, bedre dækning og
                    bedre service - alt sammen automatisk.
                  </span>
                </div>
                <div className="flex w-full items-start gap-2 flex-wrap">
                  <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                    <img
                      className="h-80 w-full flex-none object-cover"
                      src="https://res.cloudinary.com/subframe/image/upload/v1724705565/uploads/302/zltdyudg7ksbnmbba3dr.png"
                      alt="Lavere priser"
                    />
                    <div className="flex w-full grow shrink-0 basis-0 items-end gap-4 bg-default-background px-8 py-6">
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                        <span className="w-full text-body-bold font-body-bold text-subtext-color">
                          Lavere priser
                        </span>
                        <span className="w-full text-body-bold font-body-bold text-default-font">
                          Spar tusinder om året ved at skifte til bedre tilbud
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                    <img
                      className="h-80 w-full flex-none object-cover"
                      src="https://res.cloudinary.com/subframe/image/upload/v1724705572/uploads/302/xzjcr09rkc1fjxfcqsry.png"
                      alt="Bedre dækning"
                    />
                    <div className="flex w-full grow shrink-0 basis-0 items-end gap-4 bg-default-background px-8 py-6">
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                        <span className="w-full text-body-bold font-body-bold text-subtext-color">
                          Bedre dækning
                        </span>
                        <span className="w-full text-body-bold font-body-bold text-default-font">
                          Find huller i din dækning og få bedre beskyttelse
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-[320px] grow shrink-0 basis-0 flex-col items-center self-stretch overflow-hidden rounded-2xl shadow-[0px_4px_16px_-4px_#0000000a]">
                    <img
                      className="h-80 w-full flex-none object-cover"
                      src="https://res.cloudinary.com/subframe/image/upload/v1724705580/uploads/302/qolqvlz8wpmqlvb4ahlr.png"
                      alt="Nemt og hurtigt"
                    />
                    <div className="flex w-full grow shrink-0 basis-0 items-end gap-4 bg-default-background px-8 py-6">
                      <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
                        <span className="w-full text-body-bold font-body-bold text-subtext-color">
                          Nemt og hurtigt
                        </span>
                        <span className="w-full text-body-bold font-body-bold text-default-font">
                          Slut med lange telefonkøer og forvirrede kontrakter
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex w-full flex-col items-center justify-center gap-8 px-6 py-16">
          <div className="flex w-full max-w-[1024px] items-center justify-between flex-wrap gap-8">
            <span className="text-heading-3 font-heading-3 text-default-font">
              Bedretilbud.com
            </span>
            <div className="flex items-center gap-8">
              <LinkButton onClick={() => {}}>
                Privatlivspolitik
              </LinkButton>
              <LinkButton onClick={() => {}}>
                Kontakt
              </LinkButton>
            </div>
          </div>
          <span className="text-caption font-caption text-subtext-color">
            © 2024 Bedretilbud.com. Alle rettigheder forbeholdes.
          </span>
        </div>
      </div>
    </div>
  );
}
