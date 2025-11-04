import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { SidebarWithSections } from "@/ui/components/SidebarWithSections";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Eye, TrendingUp, UserCircle } from "lucide-react";

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
    <SidebarWithSections
      header={
        <span className="text-heading-2 font-heading-2 text-default-font">
          Bedretilbud.com
        </span>
      }
      footer={
        <Button
          variant="brand-primary"
          size="medium"
          className="w-full"
          onClick={() => {}}
          data-testid="button-refer-friend"
        >
          Få bedre tilbud
        </Button>
      }
    >
      {/* Oversigt Section */}
      <SidebarWithSections.NavSection label="Oversigt">
        <Link href="/offers">
          <SidebarWithSections.NavItem
            icon={<Eye />}
            selected={location === "/offers"}
            data-testid="nav-offers"
          >
            Se alle bedre tilbud
          </SidebarWithSections.NavItem>
        </Link>
        <Link href="#">
          <SidebarWithSections.NavItem
            icon={<TrendingUp />}
            selected={false}
            data-testid="nav-get-offers"
          >
            Få flere tilbud
          </SidebarWithSections.NavItem>
        </Link>
        <Link href={`/profile/${userId}`}>
          <SidebarWithSections.NavItem
            icon={<UserCircle />}
            selected={location === `/profile/${userId}`}
            data-testid="nav-profile"
          >
            Din profil
          </SidebarWithSections.NavItem>
        </Link>
      </SidebarWithSections.NavSection>

      {/* Dine bedre tilbud Section */}
      <SidebarWithSections.NavSection label="Dine bedre tilbud">
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
            <Link key={comparison.id} href={`/comparison/${comparison.id}`}>
              <SidebarWithSections.NavItem
                selected={location === `/comparison/${comparison.id}`}
                rightSlot={
                  <Badge variant="brand" data-testid={`badge-comparison-${comparison.id}`}>
                    Se tilbud
                  </Badge>
                }
                data-testid={`nav-comparison-${comparison.id}`}
              >
                {comparison.companyName}
              </SidebarWithSections.NavItem>
            </Link>
          ))
        )}
      </SidebarWithSections.NavSection>

      {/* Tilbud indhentes Section */}
      <SidebarWithSections.NavSection label="Tilbud indhentes">
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
            <SidebarWithSections.NavItem
              key={thread.id}
              selected={false}
              rightSlot={
                <Badge variant="neutral" data-testid={`badge-pending-${thread.id}`}>
                  På vej
                </Badge>
              }
              data-testid={`nav-pending-${thread.id}`}
            >
              {thread.companyName}
            </SidebarWithSections.NavItem>
          ))
        )}
      </SidebarWithSections.NavSection>
    </SidebarWithSections>
  );
}
