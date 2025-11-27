import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { SidebarWithMinimalTextSections, Badge, Button } from "@/ui";
import { 
  FeatherCoins, 
  FeatherRocket, 
  FeatherUser, 
  FeatherShield,
  FeatherHome,
  FeatherBuilding,
  FeatherCar,
  FeatherPlane,
  FeatherChevronDown,
  FeatherChevronRight
} from "@subframe/core";

interface NavigationSidebarProps {
  userId?: string;
}

const policyTypeLabels: { [key: string]: string } = {
  indbo: "Indbo",
  ulykke: "Ulykke",
  hus: "Hus",
  bil: "Bil",
  rejse: "Rejse"
};

const policyTypeIcons: { [key: string]: any } = {
  indbo: FeatherHome,
  ulykke: FeatherShield,
  hus: FeatherBuilding,
  bil: FeatherCar,
  rejse: FeatherPlane
};

export function NavigationSidebar({ userId }: NavigationSidebarProps) {
  const [location] = useLocation();
  const searchString = useSearch();
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  
  const currentTab = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('tab') || 'samlet';
  }, [searchString]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/nav-data", userId],
    enabled: !!userId,
  });

  const navData = data as {
    companies: Array<{
      companyId: string;
      comparisonId: string;
      companyName: string;
      policyTypes: string[];
      hasCombinedView: boolean;
    }>;
    pendingThreads: Array<{ id: string; companyName: string; companyId: string }>;
  } | undefined;

  useEffect(() => {
    if (navData?.companies) {
      const activeCompany = navData.companies.find(company => 
        location.includes(`/sammenligning/${company.comparisonId}`)
      );
      
      if (activeCompany) {
        setExpandedCompanies(prev => {
          const newSet = new Set(prev);
          newSet.add(activeCompany.companyId);
          return newSet;
        });
      }
    }
  }, [location, navData]);

  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const isCompanyRoute = (comparisonId: string) => {
    return location.includes(`/sammenligning/${comparisonId}`);
  };

  return (
    <SidebarWithMinimalTextSections
      header={
        <div className="flex w-full items-center gap-4">
          <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
            Bedretilbud.com
          </span>
        </div>
      }
      footer={
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex w-full items-center gap-6 rounded-md border border-solid border-neutral-border bg-default-background px-6 py-6 shadow-sm">
            <FeatherRocket className="text-heading-1 font-heading-1 text-brand-700" />
            <div className="flex grow shrink-0 basis-0 flex-col items-start gap-1">
              <span className="text-body-bold font-body-bold text-default-font">
                Få gratis flere tilbud
              </span>
              <span className="text-caption font-caption text-subtext-color">
                Inviter dine venner
              </span>
            </div>
          </div>
          <Link href="#" className="w-full">
            <Button
              className="h-8 w-full flex-none"
              disabled={false}
              variant="brand-primary"
              size="medium"
              icon={null}
              iconRight={null}
              loading={false}
              data-testid="button-get-offers"
            >
              Få flere tilbud nu
            </Button>
          </Link>
        </div>
      }
    >
      {/* Oversigt Section */}
      <SidebarWithMinimalTextSections.NavSection label="Oversigt">
        <Link href={`/forsikringstjek/${userId}`}>
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherShield />}
            selected={location === `/forsikringstjek/${userId}`}
            data-testid="nav-forsikringstjek"
          >
            Forsikringstjek
          </SidebarWithMinimalTextSections.NavItem>
        </Link>
        <Link href="/offers">
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherCoins />}
            selected={location === "/offers"}
            data-testid="nav-offers"
          >
            Se alle bedre tilbud
          </SidebarWithMinimalTextSections.NavItem>
        </Link>
        <Link href="#">
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherRocket />}
            selected={false}
            data-testid="nav-get-offers"
          >
            Få flere tilbud
          </SidebarWithMinimalTextSections.NavItem>
        </Link>
        <Link href={`/profile/${userId}`}>
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherUser />}
            selected={location === `/profile/${userId}`}
            data-testid="nav-profile"
          >
            Din profil
          </SidebarWithMinimalTextSections.NavItem>
        </Link>
      </SidebarWithMinimalTextSections.NavSection>

      {/* Dine bedre tilbud Section */}
      <SidebarWithMinimalTextSections.NavSection label="Dine bedre tilbud">
        {isLoading ? (
          <div className="px-3 py-2 text-caption font-caption text-subtext-color" data-testid="nav-loading">
            Indlæser...
          </div>
        ) : !navData?.companies || navData.companies.length === 0 ? (
          <div className="px-3 py-2 text-caption font-caption text-subtext-color" data-testid="nav-no-comparisons">
            Ingen tilbud endnu
          </div>
        ) : (
          navData.companies.map((company) => {
            const isExpanded = expandedCompanies.has(company.companyId);
            const isActive = isCompanyRoute(company.comparisonId);
            
            return (
              <div key={company.companyId} className="flex flex-col w-full">
                <div className="flex w-full items-center gap-2 pb-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleCompany(company.companyId);
                    }}
                    className="flex items-center justify-center p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                    data-testid={`toggle-company-${company.companyId}`}
                  >
                    {isExpanded ? (
                      <FeatherChevronDown className="w-4 h-4 text-subtext-color" />
                    ) : (
                      <FeatherChevronRight className="w-4 h-4 text-subtext-color" />
                    )}
                  </button>
                  <Link href={`/sammenligning/${company.comparisonId}`} className="flex-1">
                    <SidebarWithMinimalTextSections.NavItem
                      selected={isActive}
                      data-testid={`nav-company-${company.companyId}`}
                    >
                      {company.companyName}
                    </SidebarWithMinimalTextSections.NavItem>
                  </Link>
                  <Badge variant="brand" icon={null} iconRight={null} data-testid={`badge-company-${company.companyId}`}>
                    Se tilbud
                  </Badge>
                </div>
                
                {isExpanded && (
                  <div className="flex flex-col pl-8 gap-1">
                    {company.hasCombinedView && (
                      <Link href={`/sammenligning/${company.comparisonId}?tab=samlet`}>
                        <SidebarWithMinimalTextSections.NavItem
                          selected={isActive && currentTab === 'samlet'}
                          data-testid={`nav-policy-${company.companyId}-samlet`}
                        >
                          Samlet oversigt
                        </SidebarWithMinimalTextSections.NavItem>
                      </Link>
                    )}
                    {company.policyTypes.map((policyType) => {
                      const Icon = policyTypeIcons[policyType];
                      return (
                        <Link key={policyType} href={`/sammenligning/${company.comparisonId}?tab=${policyType}`}>
                          <SidebarWithMinimalTextSections.NavItem
                            icon={Icon ? <Icon /> : undefined}
                            selected={isActive && currentTab === policyType}
                            data-testid={`nav-policy-${company.companyId}-${policyType}`}
                          >
                            {policyTypeLabels[policyType] || policyType}
                          </SidebarWithMinimalTextSections.NavItem>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </SidebarWithMinimalTextSections.NavSection>

      {/* Tilbud indhentes Section */}
      <SidebarWithMinimalTextSections.NavSection label="Tilbud indhentes">
        {isLoading ? (
          <div className="px-3 py-2 text-caption font-caption text-subtext-color" data-testid="nav-pending-loading">
            Indlæser...
          </div>
        ) : navData?.pendingThreads.length === 0 ? (
          <div className="px-3 py-2 text-caption font-caption text-subtext-color" data-testid="nav-no-pending">
            Ingen ventende forespørgsler
          </div>
        ) : (
          navData?.pendingThreads.map((thread) => (
            <div key={thread.id} className="flex w-full items-center justify-center gap-4 pb-1">
              <SidebarWithMinimalTextSections.NavItem
                selected={false}
                data-testid={`nav-pending-${thread.id}`}
              >
                {thread.companyName}
              </SidebarWithMinimalTextSections.NavItem>
              <Badge variant="neutral" icon={null} iconRight={null} data-testid={`badge-pending-${thread.id}`}>
                På vej
              </Badge>
            </div>
          ))
        )}
      </SidebarWithMinimalTextSections.NavSection>
    </SidebarWithMinimalTextSections>
  );
}
