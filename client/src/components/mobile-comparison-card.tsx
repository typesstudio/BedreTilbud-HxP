import { Badge } from "@/ui";

interface ComparisonRow {
  feature: string;
  current: string;
  offer: string;
  difference?: string;
  status?: 'better' | 'worse' | 'same';
  isCategory?: boolean;
}

interface MobileComparisonCardProps {
  rows: ComparisonRow[];
  className?: string;
}

export function MobileComparisonCard({ rows, className = "" }: MobileComparisonCardProps) {
  const groupedRows: { category: string; items: ComparisonRow[] }[] = [];
  let currentCategory = "";
  let currentItems: ComparisonRow[] = [];

  rows.forEach((row) => {
    if (row.isCategory) {
      if (currentCategory && currentItems.length > 0) {
        groupedRows.push({ category: currentCategory, items: currentItems });
      }
      currentCategory = row.feature;
      currentItems = [];
    } else {
      currentItems.push(row);
    }
  });

  if (currentCategory && currentItems.length > 0) {
    groupedRows.push({ category: currentCategory, items: currentItems });
  }

  return (
    <div className={`space-y-4 md:hidden ${className}`}>
      {groupedRows.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <div className="comparison-card-header border-b pb-2">
            {group.category}
          </div>
          <div className="space-y-3">
            {group.items.map((item, itemIndex) => (
              <div 
                key={itemIndex} 
                className="comparison-card-mobile"
                data-testid={`comparison-card-${groupIndex}-${itemIndex}`}
              >
                <div className="mb-2 text-sm font-medium text-muted-foreground">
                  {item.feature}
                </div>
                <div className="comparison-card-grid">
                  <div className="space-y-1">
                    <div className="comparison-card-label">Nuværende</div>
                    <div className="comparison-card-value">{item.current || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="comparison-card-label">Nyt tilbud</div>
                    <div className="comparison-card-value">{item.offer || "-"}</div>
                  </div>
                </div>
                {item.difference && (
                  <div className="mt-3 flex justify-center">
                    <Badge 
                      variant={
                        item.status === 'better' ? 'success' : 
                        item.status === 'worse' ? 'error' : 
                        'neutral'
                      }
                      data-testid={`badge-difference-${groupIndex}-${itemIndex}`}
                    >
                      {item.difference}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimpleMobileComparisonCard({ 
  feature, 
  current, 
  offer, 
  difference, 
  status 
}: ComparisonRow) {
  return (
    <div 
      className="comparison-card-mobile"
      data-testid={`simple-comparison-card-${feature}`}
    >
      <div className="mb-2 text-sm font-medium text-muted-foreground">
        {feature}
      </div>
      <div className="comparison-card-grid">
        <div className="space-y-1">
          <div className="comparison-card-label">Nuværende</div>
          <div className="comparison-card-value">{current || "-"}</div>
        </div>
        <div className="space-y-1">
          <div className="comparison-card-label">Nyt tilbud</div>
          <div className="comparison-card-value">{offer || "-"}</div>
        </div>
      </div>
      {difference && (
        <div className="mt-3 flex justify-center">
          <Badge 
            variant={
              status === 'better' ? 'success' : 
              status === 'worse' ? 'error' : 
              'neutral'
            }
          >
            {difference}
          </Badge>
        </div>
      )}
    </div>
  );
}
