import { Button } from "@/ui/components/Button";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Table } from "@/ui/components/Table";
import { ComparisonPolicyRowView, formatCurrency } from "@/utils/transformComparison";
import {
  FeatherHome,
  FeatherBuilding,
  FeatherShield,
  FeatherCar,
  FeatherPlane,
} from "@subframe/core";

interface ComparisonQuickTableProps {
  policies: ComparisonPolicyRowView[];
  onSelectPolicy?: (policyType: string) => void;
}

const policyTypeIcons: Record<string, any> = {
  indbo: FeatherHome,
  hus: FeatherBuilding,
  ulykke: FeatherShield,
  bil: FeatherCar,
  rejse: FeatherPlane,
};

export function ComparisonQuickTable({
  policies,
  onSelectPolicy,
}: ComparisonQuickTableProps) {
  if (policies.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="flex w-full flex-col items-start rounded-lg border border-solid border-neutral-border bg-default-background overflow-x-auto">
        <Table
          header={
            <Table.HeaderRow>
              <Table.HeaderCell>Kategori</Table.HeaderCell>
              <Table.HeaderCell>Nuværende</Table.HeaderCell>
              <Table.HeaderCell>Tilbud</Table.HeaderCell>
              <Table.HeaderCell>Besparelse</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.HeaderRow>
          }
        >
          {policies.map((policy) => {
            const Icon = policyTypeIcons[policy.policyType] || FeatherHome;
            const hasPricing = policy.currentAnnual && policy.offerAnnual;

            return (
              <Table.Row key={policy.policyType}>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <IconWithBackground
                      size="small"
                      icon={<Icon />}
                      variant={hasPricing ? "neutral" : "warning"}
                    />
                    <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                      {policy.label}
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                    {formatCurrency(policy.currentAnnual)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className={`whitespace-nowrap text-body font-body ${hasPricing ? 'text-default-font' : 'text-subtext-color'}`}>
                    {formatCurrency(policy.offerAnnual)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className={`whitespace-nowrap text-body-bold font-body-bold ${hasPricing ? 'text-success-600' : 'text-subtext-color'}`}>
                    {hasPricing ? formatCurrency(policy.savingsAnnual) : "—"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant={hasPricing ? "brand-tertiary" : "neutral-tertiary"}
                    size="small"
                    onClick={() => onSelectPolicy?.(policy.policyType)}
                    data-testid={`button-details-${policy.policyType}`}
                  >
                    {hasPricing ? "Se detaljer" : "Afventer"}
                  </Button>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
