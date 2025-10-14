import React from "react";
import { useLocation } from "wouter";
import { TopbarWithCenterNav } from "../../../src/ui/components/TopbarWithCenterNav";
import { Breadcrumbs } from "../../../src/ui/components/Breadcrumbs";
import { Avatar } from "../../../src/ui/components/Avatar";
import { User } from "lucide-react";

interface NavigationProps {
  userId?: string;
}

export function Navigation({ userId }: NavigationProps) {
  const [location, setLocation] = useLocation();

  const getBreadcrumbs = () => {
    const path = location;
    
    // Profile page - just show "Profil"
    if (path.startsWith("/profile")) {
      return [{ label: "Profil", path }];
    }
    
    // Emails/Messages page - show: Dine bedre tilbud > Sammenligning > Beskeder
    if (path.startsWith("/emails")) {
      return [
        { label: "Dine bedre tilbud", path: "/offers" },
        { label: "Sammenligning", path: "/offers" },
        { label: "Beskeder", path }
      ];
    }
    
    // Comparison page - show: Dine bedre tilbud > Sammenligning
    if (path.startsWith("/comparison")) {
      return [
        { label: "Dine bedre tilbud", path: "/offers" },
        { label: "Sammenligning", path }
      ];
    }
    
    // Offers page - show: Dine bedre tilbud
    if (path.startsWith("/offers")) {
      return [{ label: "Dine bedre tilbud", path: "/offers" }];
    }
    
    // Default for other pages (home, onboarding, etc.)
    return [{ label: "Hjem", path: "/" }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <TopbarWithCenterNav
      leftSlot={
        <Breadcrumbs>
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={`breadcrumb-${index}`}>
              <Breadcrumbs.Item
                active={index === breadcrumbs.length - 1}
                onClick={() => setLocation(item.path)}
                data-testid={`breadcrumb-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.label}
              </Breadcrumbs.Item>
              {index < breadcrumbs.length - 1 && <Breadcrumbs.Divider />}
            </React.Fragment>
          ))}
        </Breadcrumbs>
      }
      rightSlot={
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          onClick={() => userId && setLocation(`/profile/${userId}`)}
          data-testid="nav-profile-link"
        >
          <Avatar size="small" variant="neutral">
            <User className="h-4 w-4" />
          </Avatar>
          <span className="text-body-bold font-body-bold text-default-font">
            Min Profil
          </span>
        </div>
      }
    />
  );
}
