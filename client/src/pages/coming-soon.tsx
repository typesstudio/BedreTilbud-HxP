import { useState } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowRight, 
  Eye, 
  Percent, 
  Sparkles, 
  MessageCircle,
  Type,
  CheckCircle2
} from "lucide-react";

function ComingSoon() {
  const [email, setEmail] = useState("");
  const [isSignedUp, setIsSignedUp] = useState(false);

  const signupMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      setIsSignedUp(true);
      setEmail("");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      signupMutation.mutate(email);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center bg-default-background" data-testid="page-coming-soon">
      <div className="flex w-full flex-col items-center">
        <div className="flex min-h-[576px] w-full flex-col items-center justify-center gap-16 px-4 pt-16 pb-32 bg-gradient-to-br from-brand-50 via-white to-neutral-50">
          <div className="flex w-64 items-center justify-center gap-2 rounded-lg border border-solid border-neutral-200 bg-white px-6 py-4 shadow-sm">
            <span className="text-heading-3 font-heading-3 text-default-font" data-testid="text-logo">
              Bedretilbud.com
            </span>
          </div>
          <div className="flex w-full max-w-[576px] flex-col items-center gap-16">
            <div className="flex items-center gap-1 rounded-md border border-solid border-brand-200 bg-brand-50 pl-3 pr-2 py-1">
              <span className="whitespace-nowrap font-['Inter'] text-[14px] font-[500] leading-[20px] text-brand-700">
                Automatisk besparelse
              </span>
              <Sparkles className="h-4 w-4 text-brand-700" />
            </div>
            <div className="flex w-full flex-col items-center gap-4">
              <span className="w-full font-['Inter'] text-[48px] md:text-[64px] font-[600] leading-[52px] md:leading-[68px] text-default-font text-center -tracking-[0.04em]">
                Stop med at betale for meget
              </span>
              <span className="w-full font-['Inter'] text-[18px] md:text-[20px] font-[500] leading-[26px] md:leading-[28px] text-subtext-color text-center -tracking-[0.02em]">
                Vi forhandler automatisk med forsikringsselskaber på dine vegne.
                Upload din police og spar uden besvær.
              </span>
            </div>
            
            {isSignedUp ? (
              <div className="flex w-full items-center justify-center gap-3 rounded-md border border-solid border-green-200 bg-green-50 px-6 py-4 shadow-lg" data-testid="signup-success">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div className="flex flex-col">
                  <span className="font-['Inter'] text-[16px] font-[600] leading-[24px] text-green-800">
                    Tak! Du er nu skrevet op
                  </span>
                  <span className="font-['Inter'] text-[14px] font-[400] leading-[20px] text-green-700">
                    Vi sender dig en besked, når vi er klar til at hjælpe dig.
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 rounded-md border border-solid border-neutral-200 bg-white px-2 py-2 shadow-lg">
                <TextField
                  className="h-auto grow shrink-0 basis-0"
                  label=""
                  helpText=""
                >
                  <TextField.Input
                    placeholder="din@email.dk"
                    value={email}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                    data-testid="input-email-signup"
                  />
                </TextField>
                <Button
                  variant="variation"
                  size="large"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                  type="submit"
                  loading={signupMutation.isPending}
                  data-testid="button-signup"
                >
                  Skriv dig op
                </Button>
              </form>
            )}
            
            <div className="flex w-full max-w-[448px] flex-col items-center gap-4">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <img
                      className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover"
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
                      alt="Bruger 1"
                    />
                    <img
                      className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover -ml-2"
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
                      alt="Bruger 2"
                    />
                    <img
                      className="h-8 w-8 flex-none rounded-full border-2 border-solid border-neutral-900 object-cover -ml-2"
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop"
                      alt="Bruger 3"
                    />
                  </div>
                  <span className="text-body font-body text-subtext-color">
                    12.400+ danskere får bedre tilbud
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full max-w-[1024px] flex-wrap items-center gap-12 py-16">
            <div className="flex min-w-[160px] grow shrink-0 basis-0 flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-default-font" />
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
                <Eye className="h-4 w-4 text-default-font" />
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
                <Type className="h-4 w-4 text-default-font" />
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
                <Percent className="h-4 w-4 text-default-font" />
                <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-default-font -tracking-[0.01em]">
                  Ikke i lommen på selskaberne
                </span>
              </div>
              <span className="font-['Inter'] text-[14px] font-[500] leading-[20px] text-subtext-color -tracking-[0.01em]">
                Vi tjener ikke en lead pris fra forsikrings selskaberne
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComingSoon;
