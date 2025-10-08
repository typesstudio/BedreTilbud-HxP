import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Mail, Send, Clock, CheckCircle } from "lucide-react";

interface OfferCardProps {
  thread: any;
  comparison?: any;
  onViewComparison: () => void;
  onViewEmails: () => void;
}

export default function OfferCard({ thread, comparison, onViewComparison, onViewEmails }: OfferCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="secondary" className="status-badge status-sent">
            <Send className="w-4 h-4" />
            Sendt
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="status-badge status-pending">
            <Clock className="w-4 h-4" />
            Afventer svar
          </Badge>
        );
      case "received":
        return (
          <Badge variant="secondary" className="status-badge status-received">
            <CheckCircle className="w-4 h-4" />
            Modtaget
          </Badge>
        );
      default:
        return null;
    }
  };

  const hasComparison = comparison && comparison.savings !== undefined;

  return (
    <Card
      className={`shadow-card p-6 border-2 hover:shadow-card-lg transition-shadow ${
        thread.status === 'received' ? 'border-green-200' : 'border-border'
      }`}
      data-testid={`offer-card-${thread.id}`}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {thread.company?.name?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                {thread.company?.name || 'Ukendt selskab'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Sendt {new Date(thread.createdAt).toLocaleDateString('da-DK')}
              </p>
            </div>
          </div>
          {getStatusBadge(thread.status)}
        </div>

        {hasComparison && (
          <div className="flex flex-wrap gap-3 mb-4">
            {comparison.savings > 0 && (
              <Badge variant="secondary" className="bg-green-50 text-green-700">
                Spar {comparison.savings} kr./år
              </Badge>
            )}
            {comparison.savings < 0 && (
              <Badge variant="secondary" className="bg-red-50 text-red-700">
                {Math.abs(comparison.savings)} kr. dyrere/år
              </Badge>
            )}
            {comparison.comparisonData?.pros?.slice(0, 1).map((pro: string, index: number) => (
              <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700">
                {pro.length > 30 ? `${pro.substring(0, 30)}...` : pro}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {hasComparison ? (
            <Button
              className="flex-1"
              onClick={onViewComparison}
              data-testid={`button-view-comparison-${thread.id}`}
            >
              <Eye className="mr-2 w-4 h-4" />
              Se sammenligning
            </Button>
          ) : thread.status === 'received' ? (
            <Button
              className="flex-1"
              disabled
              variant="outline"
            >
              Behandler tilbud...
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled
              variant="outline"
            >
              Afventer svar
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onViewEmails}
            data-testid={`button-view-emails-${thread.id}`}
          >
            <Mail className="mr-2 w-4 h-4" />
            Se besked
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
