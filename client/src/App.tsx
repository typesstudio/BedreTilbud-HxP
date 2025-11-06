import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const NotFound = lazy(() => import("@/pages/not-found"));
const ModernLandingPage = lazy(() => import("@/pages/ModernLandingPage"));
const LandingWizard = lazy(() => import("@/pages/LandingWizard"));
const Home = lazy(() => import("@/pages/home"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const OffersOverview = lazy(() => import("@/pages/offers-overview"));
const Comparison = lazy(() => import("@/pages/comparison"));
const EmailCorrespondence = lazy(() => import("@/pages/email-correspondence"));
const UploadOffer = lazy(() => import("@/pages/upload-offer"));
const GmailSetup = lazy(() => import("@/pages/gmail-setup"));
const SendInquiry = lazy(() => import("@/pages/send-inquiry"));
const AdminTesting = lazy(() => import("@/pages/admin-testing"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const InsuranceCheck = lazy(() => import("@/pages/insurance-check"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={ModernLandingPage} />
        <Route path="/wizard" component={LandingWizard} />
        <Route path="/home" component={Home} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/onboarding/:step" component={Onboarding} />
        <Route path="/offers" component={OffersOverview} />
        <Route path="/upload-offer" component={UploadOffer} />
        <Route path="/send-inquiry" component={SendInquiry} />
        <Route path="/comparison/:id" component={Comparison} />
        <Route path="/emails/:threadId" component={EmailCorrespondence} />
        <Route path="/profile/:userId" component={ProfilePage} />
        <Route path="/gmail-setup" component={GmailSetup} />
        <Route path="/check" component={InsuranceCheck} />
        <Route path="/admin" component={AdminTesting} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
