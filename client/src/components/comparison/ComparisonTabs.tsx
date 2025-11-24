import { ListingsTabs } from "@/ui/components/ListingsTabs";
import {
  FeatherStar,
  FeatherHome,
  FeatherShield,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
} from "@subframe/core";

export const policyTypeIcons: { [key: string]: any } = {
  samlet: FeatherStar,
  indbo: FeatherHome,
  ulykke: FeatherShield,
  hus: FeatherBuilding,
  fritidshus: FeatherBuilding,
  bil: FeatherCar,
  rejse: FeatherPlane,
};

export const policyTypeLabels: { [key: string]: string } = {
  samlet: "Samlet",
  indbo: "Indbo",
  ulykke: "Ulykke",
  hus: "Hus",
  fritidshus: "Hus",
  bil: "Bil",
  rejse: "Rejse",
};

interface ComparisonTabsProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  availableTabs?: string[];
  className?: string;
}

export function ComparisonTabs({
  selectedTab,
  onTabChange,
  availableTabs = ["samlet", "indbo", "ulykke", "hus", "bil", "rejse"],
  className = "",
}: ComparisonTabsProps) {
  return (
    <div className={`flex w-full items-center gap-2 overflow-x-auto ${className}`}>
      <ListingsTabs>
        {availableTabs.map((tab) => {
          const Icon = policyTypeIcons[tab] || FeatherStar;
          const label = policyTypeLabels[tab] || tab;
          return (
            <ListingsTabs.Item
              key={tab}
              checked={selectedTab === tab}
              icon={<Icon />}
              onClick={() => onTabChange(tab)}
            >
              {label}
            </ListingsTabs.Item>
          );
        })}
      </ListingsTabs>
    </div>
  );
}
