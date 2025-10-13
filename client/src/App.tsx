import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Onboarding from "@/pages/onboarding";
import OffersOverview from "@/pages/offers-overview";
import Comparison from "@/pages/comparison";
import EmailCorrespondence from "@/pages/email-correspondence";
import UploadOffer from "@/pages/upload-offer";
import GmailSetup from "@/pages/gmail-setup";
import SendInquiry from "@/pages/send-inquiry";
import AdminTesting from "@/pages/admin-testing";
import ProfilePage from "@/pages/ProfilePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/onboarding/:step" component={Onboarding} />
      <Route path="/offers" component={OffersOverview} />
      <Route path="/upload-offer" component={UploadOffer} />
      <Route path="/send-inquiry" component={SendInquiry} />
      <Route path="/comparison/:id" component={Comparison} />
      <Route path="/emails/:threadId" component={EmailCorrespondence} />
      <Route path="/profile/:userId" component={ProfilePage} />
      <Route path="/gmail-setup" component={GmailSetup} />
      <Route path="/admin" component={AdminTesting} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
