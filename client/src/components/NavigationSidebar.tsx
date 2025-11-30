import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { SidebarWithMinimalTextSections, Badge, Button, IconButton } from "@/ui";
import { 
  FeatherCoins, 
  FeatherRocket, 
  FeatherUser,
  FeatherShield,
  FeatherChevronsLeft,
  FeatherMenu,
  FeatherFileText,
  FeatherClock
} from "@subframe/core";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavigationSidebarProps {
  userId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function NavigationSidebar({ userId, isCollapsed = false, onToggleCollapse }: NavigationSidebarProps) {
  const [location] = useLocation();

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
    currentInsuranceSnapshotId: string | null;
  } | undefined;

  const isCompanyRoute = (comparisonId: string) => {
    return location.includes(`/sammenligning/${comparisonId}`);
  };

  const forsikringstjekUrl = navData?.currentInsuranceSnapshotId 
    ? `/sundhedstjek/${navData.currentInsuranceSnapshotId}`
    : `/forsikringstjek/${userId}`;

  const isForsikringstjekActive = location.startsWith('/sundhedstjek/') || location === `/forsikringstjek/${userId}`;

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="flex h-full w-20 flex-none flex-col items-start gap-6 border-r border-solid border-neutral-border bg-default-background px-3 py-6 shadow-sm transition-all duration-300">
          <div className="flex w-full flex-col items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<FeatherMenu />}
                  onClick={onToggleCollapse}
                  data-testid="button-expand-sidebar"
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Udvid menu</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex w-full flex-col items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={forsikringstjekUrl}>
                  <IconButton
                    variant={isForsikringstjekActive ? "brand-tertiary" : "neutral-tertiary"}
                    icon={<FeatherShield />}
                    data-testid="nav-forsikringstjek-collapsed"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Forsikringstjek</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/offers">
                  <IconButton
                    variant={location === "/offers" ? "brand-tertiary" : "neutral-tertiary"}
                    icon={<FeatherCoins />}
                    data-testid="nav-offers-collapsed"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Se alle bedre tilbud</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/selskaber">
                  <IconButton
                    variant={location === "/selskaber" ? "brand-tertiary" : "neutral-tertiary"}
                    icon={<FeatherRocket />}
                    data-testid="nav-get-offers-collapsed"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Få flere tilbud</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/profile/${userId}`}>
                  <IconButton
                    variant={location === `/profile/${userId}` ? "brand-tertiary" : "neutral-tertiary"}
                    icon={<FeatherUser />}
                    data-testid="nav-profile-collapsed"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Din profil</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full flex-col items-center gap-4">
            {navData?.companies && navData.companies.length > 0 ? (
              navData.companies.map((company) => (
                <Tooltip key={company.companyId}>
                  <TooltipTrigger asChild>
                    <Link href={`/sammenligning/${company.comparisonId}?tab=samlet`}>
                      <IconButton
                        variant={isCompanyRoute(company.comparisonId) ? "brand-tertiary" : "neutral-tertiary"}
                        icon={<FeatherFileText />}
                        data-testid={`nav-company-collapsed-${company.companyId}`}
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{company.companyName}</p>
                  </TooltipContent>
                </Tooltip>
              ))
            ) : null}
          </div>
          <div className="flex h-px w-full flex-none flex-col items-center gap-2 bg-neutral-border" />
          <div className="flex w-full flex-col items-center gap-4">
            {navData?.pendingThreads && navData.pendingThreads.length > 0 ? (
              navData.pendingThreads.map((thread) => (
                <Tooltip key={thread.id}>
                  <TooltipTrigger asChild>
                    <IconButton
                      icon={<FeatherClock />}
                      data-testid={`nav-pending-collapsed-${thread.id}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{thread.companyName} - På vej</p>
                  </TooltipContent>
                </Tooltip>
              ))
            ) : null}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <SidebarWithMinimalTextSections
      header={
        <div className="flex w-full items-center gap-4">
          <span className="grow shrink-0 basis-0 text-heading-3 font-heading-3 text-default-font">
            Bedretilbud.com
          </span>
          <IconButton
            icon={<FeatherChevronsLeft />}
            onClick={onToggleCollapse}
            size="small"
            data-testid="button-collapse-sidebar"
          />
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
          <Link href="/selskaber" className="w-full">
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
        <Link href={forsikringstjekUrl}>
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherShield />}
            selected={isForsikringstjekActive}
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
        <Link href="/selskaber">
          <SidebarWithMinimalTextSections.NavItem
            icon={<FeatherRocket />}
            selected={location === "/selskaber"}
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
            const isActive = isCompanyRoute(company.comparisonId);
            
            return (
              <Link key={company.companyId} href={`/sammenligning/${company.comparisonId}?tab=samlet`} className="w-full">
                <div className="flex w-full items-center gap-2 pb-1">
                  <SidebarWithMinimalTextSections.NavItem
                    selected={isActive}
                    className="flex-1"
                    data-testid={`nav-company-${company.companyId}`}
                  >
                    {company.companyName}
                  </SidebarWithMinimalTextSections.NavItem>
                  <Badge variant="brand" icon={null} iconRight={null} data-testid={`badge-company-${company.companyId}`}>
                    Se tilbud
                  </Badge>
                </div>
              </Link>
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
