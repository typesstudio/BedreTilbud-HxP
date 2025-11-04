import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { SidebarWithMinimalTextSections, Badge, Button } from "@/ui";
import { FeatherCoins, FeatherRocket, FeatherUser } from "@subframe/core";

interface NavigationSidebarProps {
  userId: string;
}

export function NavigationSidebar({ userId }: NavigationSidebarProps) {
  const [location] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/nav-data", userId],
  });

  const navData = data as {
    comparisons: Array<{ id: string; companyName: string; companyId: string }>;
    pendingThreads: Array<{ id: string; companyName: string; companyId: string }>;
  } | undefined;

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
        ) : navData?.comparisons.length === 0 ? (
          <div className="px-3 py-2 text-caption font-caption text-subtext-color" data-testid="nav-no-comparisons">
            Ingen tilbud endnu
          </div>
        ) : (
          navData?.comparisons.map((comparison) => (
            <div key={comparison.id} className="flex w-full items-center justify-center gap-4 pb-1">
              <Link href={`/comparison/${comparison.id}`} className="flex-1">
                <SidebarWithMinimalTextSections.NavItem
                  selected={location === `/comparison/${comparison.id}`}
                  data-testid={`nav-comparison-${comparison.id}`}
                >
                  {comparison.companyName}
                </SidebarWithMinimalTextSections.NavItem>
              </Link>
              <Badge variant="brand" icon={null} iconRight={null} data-testid={`badge-comparison-${comparison.id}`}>
                Se tilbud
              </Badge>
            </div>
          ))
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
