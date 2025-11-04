import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../src/ui/components/Button";
import { FeatherCheck, FeatherX, FeatherExternalLink } from "@subframe/core";
import { AppLayoutWithNav } from "@/components/AppLayoutWithNav";

export default function GmailSetup() {
  const userId = localStorage.getItem("userId");
  const { data: status, isLoading } = useQuery({
    queryKey: ["/api/gmail/status"],
  });

  const handleConnect = () => {
    window.location.href = "/auth/gmail";
  };

  return (
    <AppLayoutWithNav userId={userId!}>
      <div className="flex w-full flex-col items-start gap-6 bg-default-background px-6 py-6">
        <div className="flex w-full flex-col items-start gap-4">
          <h1 className="text-heading-1 font-heading-1 text-default-font">
            Gmail Integration Setup
          </h1>
          <p className="text-body font-body text-subtext-color">
            Configure Gmail OAuth for automatic email monitoring and processing.
          </p>
        </div>

        {/* Status Card */}
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <h2 className="text-heading-2 font-heading-2 text-default-font">
            Connection Status
          </h2>
          
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-body font-body text-subtext-color">Checking status...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                {status?.configured ? (
                  <FeatherCheck className="text-success-600" />
                ) : (
                  <FeatherX className="text-error-600" />
                )}
                <span className="text-body font-body text-default-font">
                  OAuth Configured: {status?.configured ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {status?.authorized ? (
                  <FeatherCheck className="text-success-600" />
                ) : (
                  <FeatherX className="text-error-600" />
                )}
                <span className="text-body font-body text-default-font">
                  Authorized: {status?.authorized ? "Yes" : "No"}
                </span>
              </div>

              {status?.authorized && (
                <>
                  <div className="flex items-center gap-3">
                    {status?.hasRefreshToken ? (
                      <FeatherCheck className="text-success-600" />
                    ) : (
                      <FeatherX className="text-error-600" />
                    )}
                    <span className="text-body font-body text-default-font">
                      Refresh Token: {status?.hasRefreshToken ? "Available" : "Missing"}
                    </span>
                  </div>

                  {status?.expiresAt && (
                    <div className="flex items-center gap-3">
                      <span className="text-body font-body text-subtext-color">
                        Expires: {new Date(status.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-neutral-50 px-6 py-6">
          <h2 className="text-heading-2 font-heading-2 text-default-font">
            Setup Instructions
          </h2>
          
          <div className="flex flex-col gap-3">
            <p className="text-body font-body text-default-font">
              <strong>Step 1:</strong> Follow the guide to set up Google Cloud Console
            </p>
            <a 
              href="/GMAIL_SETUP_GUIDE.md" 
              target="_blank"
              className="inline-flex items-center gap-2 text-brand-600 hover:underline"
            >
              <FeatherExternalLink className="w-4 h-4" />
              <span>Open Setup Guide</span>
            </a>

            <p className="text-body font-body text-default-font mt-4">
              <strong>Step 2:</strong> Add credentials to Replit Secrets
            </p>
            <ul className="list-disc list-inside text-body font-body text-subtext-color ml-4">
              <li>GMAIL_CLIENT_ID</li>
              <li>GMAIL_CLIENT_SECRET</li>
              <li>GMAIL_REDIRECT_URI (optional)</li>
            </ul>

            <p className="text-body font-body text-default-font mt-4">
              <strong>Step 3:</strong> Connect your Gmail account
            </p>
            {!status?.authorized ? (
              <Button
                variant="brand"
                onClick={handleConnect}
                disabled={!status?.configured}
                data-testid="button-connect-gmail"
              >
                Connect Gmail
              </Button>
            ) : (
              <Button
                variant="success"
                onClick={handleConnect}
                data-testid="button-reconnect-gmail"
              >
                Reconnect Gmail
              </Button>
            )}

            {!status?.configured && (
              <p className="text-caption font-caption text-error-600">
                Please add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to Replit Secrets first
              </p>
            )}
          </div>
        </div>

        {/* Required Scopes */}
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-neutral-border bg-default-background px-6 py-6">
          <h2 className="text-heading-2 font-heading-2 text-default-font">
            Required Gmail Scopes
          </h2>
          <ul className="list-disc list-inside text-body font-body text-subtext-color ml-4">
            <li>https://www.googleapis.com/auth/gmail.readonly (Read inbox)</li>
            <li>https://www.googleapis.com/auth/gmail.send (Send emails)</li>
            <li>https://www.googleapis.com/auth/gmail.modify (Modify labels)</li>
            <li>https://www.googleapis.com/auth/userinfo.email (User info)</li>
          </ul>
        </div>
      </div>
    </AppLayoutWithNav>
  );
}
