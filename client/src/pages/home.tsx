import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";
import { Shield, Upload, Mail, BarChart3 } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();

  // Check if user has started onboarding
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) {
      setLocation("/offers");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
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
        {/* Hero Section */}
        <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <BlurFade delay={0} direction="up">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 md:mb-6">
                Find bedre forsikringstilbud
              </h2>
            </BlurFade>
            <BlurFade delay={0.1} direction="up">
              <p className="text-lg md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto">
                Upload dine nuværende forsikringer, og vi hjælper dig med at finde bedre tilbud 
                fra Danmarks største forsikringsselskaber.
              </p>
            </BlurFade>
            <BlurFade delay={0.2} direction="up">
              <Button 
                size="lg" 
                onClick={() => setLocation("/onboarding")}
                className="text-base md:text-lg px-8 md:px-12 h-14 md:h-auto md:py-6 touch-target w-full sm:w-auto"
                data-testid="button-start-process"
              >
                Kom i gang
              </Button>
            </BlurFade>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <BlurFade delay={0} direction="up" inView>
              <h3 className="text-3xl font-bold text-center text-foreground mb-12">
                Sådan virker det
              </h3>
            </BlurFade>
            <div className="grid md:grid-cols-4 gap-8">
              <BlurFade delay={0.15} direction="up" inView>
                <Card className="text-center shadow-card h-full">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">1. Upload</h4>
                    <p className="text-muted-foreground">
                      Upload dine nuværende forsikringsdokumenter (PDF)
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>

              <BlurFade delay={0.25} direction="up" inView>
                <Card className="text-center shadow-card h-full">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">2. Send</h4>
                    <p className="text-muted-foreground">
                      Vi sender personlige forespørgsler til valgte selskaber
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>

              <BlurFade delay={0.35} direction="up" inView>
                <Card className="text-center shadow-card h-full">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">3. Modtag</h4>
                    <p className="text-muted-foreground">
                      Modtag og overvåg tilbud automatisk via e-mail
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>

              <BlurFade delay={0.45} direction="up" inView>
                <Card className="text-center shadow-card h-full">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="text-xl font-semibold text-foreground mb-2">4. Sammenlign</h4>
                    <p className="text-muted-foreground">
                      Se AI-drevne sammenligninger og vælg det bedste tilbud
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <BlurFade delay={0} direction="up" inView>
              <h3 className="text-3xl font-bold text-foreground mb-4">
                Klar til at spare penge?
              </h3>
            </BlurFade>
            <BlurFade delay={0.1} direction="up" inView>
              <p className="text-lg text-muted-foreground mb-8">
                Det tager kun få minutter at komme i gang
              </p>
            </BlurFade>
            <BlurFade delay={0.2} direction="up" inView>
              <Button 
                size="lg" 
                onClick={() => setLocation("/onboarding")}
                className="text-base md:text-lg px-8 md:px-12 h-14 md:h-auto md:py-6 touch-target w-full sm:w-auto"
                data-testid="button-start-cta"
              >
                Start nu - det er gratis
              </Button>
            </BlurFade>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-foreground mb-3">BedreTilbud</h3>
              <p className="text-sm text-muted-foreground">
                Vi hjælper dig med at finde bedre forsikringstilbud - nemt og sikkert.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-primary">Om os</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Sådan virker det</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Privatlivspolitik</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Vilkår</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Kontakt</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Email: kontakt@bedretilbud.dk</li>
                <li>Telefon: +45 12 34 56 78</li>
                <li>Mandag-Fredag: 9:00-17:00</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 BedreTilbud. Alle rettigheder forbeholdes.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
