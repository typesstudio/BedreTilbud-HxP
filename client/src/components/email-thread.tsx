import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paperclip, Edit } from "lucide-react";

interface EmailThreadProps {
  emails: any[];
  company: any;
  getDirectionBadge: (direction: string) => React.ReactNode;
}

export default function EmailThread({ emails, company, getDirectionBadge }: EmailThreadProps) {
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEmailHeader = (email: any) => {
    switch (email.direction) {
      case 'outbound':
        return `Dig → ${company?.name || 'Forsikringsselskab'}`;
      case 'inbound':
        return `${company?.name || 'Forsikringsselskab'} → Dig`;
      case 'auto':
        return `AI Assistent → ${company?.name || 'Forsikringsselskab'}`;
      default:
        return 'Ukendt afsender';
    }
  };

  const getEmailStyle = (direction: string) => {
    switch (direction) {
      case 'outbound':
        return 'bg-muted';
      case 'inbound':
        return 'bg-green-50 border-2 border-green-200';
      case 'auto':
        return 'bg-accent/10 border-2 border-accent/30';
      default:
        return 'bg-muted';
    }
  };

  const getDotStyle = (direction: string) => {
    switch (direction) {
      case 'outbound':
        return 'bg-primary';
      case 'inbound':
        return 'bg-green-600';
      case 'auto':
        return 'bg-accent';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="space-y-8">
      {emails.map((email: any, index: number) => (
        <div key={email.id || index} className="email-thread-item">
          <div className={`email-thread-dot ${getDotStyle(email.direction)}`}></div>
          <div className={`rounded-xl p-6 ${getEmailStyle(email.direction)}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-foreground" data-testid={`email-header-${index}`}>
                  {getEmailHeader(email)}
                </p>
                <p className="text-sm text-muted-foreground" data-testid={`email-date-${index}`}>
                  {email.sentAt ? formatDate(email.sentAt) : 'Dato ikke tilgængelig'}
                </p>
              </div>
              {getDirectionBadge(email.direction)}
            </div>

            {email.direction === 'auto' && (
              <div className="bg-white/50 rounded-lg p-4 mb-4">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  AI-genereret svar baseret på tilbuddet
                </p>
              </div>
            )}

            <div className="prose prose-sm max-w-none">
              {email.subject && (
                <p className="text-foreground mb-3" data-testid={`email-subject-${index}`}>
                  <strong>Emne:</strong> {email.subject}
                </p>
              )}
              <div 
                className="text-foreground whitespace-pre-wrap" 
                data-testid={`email-body-${index}`}
              >
                {email.body || 'Ingen indhold tilgængeligt'}
              </div>
            </div>

            {email.attachments && email.attachments.length > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground" data-testid={`email-attachments-${index}`}>
                  {email.attachments.length} vedhæftede fil{email.attachments.length !== 1 ? 'er' : ''}
                  {email.attachments.length === 1 && email.attachments[0].fileName && 
                    `: ${email.attachments[0].fileName}`
                  }
                </span>
              </div>
            )}

            {email.direction === 'auto' && (
              <Button 
                variant="ghost"
                size="sm"
                className="mt-4 text-primary hover:text-primary/80 text-sm font-semibold flex items-center gap-1"
                data-testid={`button-edit-auto-response-${index}`}
              >
                <Edit className="w-4 h-4" />
                Rediger før afsendelse
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
