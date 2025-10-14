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
    const segments = path.split("/").filter(Boolean);

    const breadcrumbMap: Record<string, string> = {
      "": "Hjem",
      "offers": "Mine Tilbud",
      "comparison": "Sammenligning",
      "emails": "Korrespondance",
      "profile": "Profil",
      "onboarding": "Opstart",
      "upload-offer": "Upload Tilbud",
      "send-inquiry": "Send Forespørgsel",
    };

    const items = [
      { label: "Hjem", path: "/" },
    ];

    segments.forEach((segment, index) => {
      const label = breadcrumbMap[segment] || segment;
      const path = "/" + segments.slice(0, index + 1).join("/");
      items.push({ label, path });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <TopbarWithCenterNav
      leftSlot={
        <Breadcrumbs>
          {breadcrumbs.map((item, index) => (
            <>
              <Breadcrumbs.Item
                key={item.path}
                active={index === breadcrumbs.length - 1}
                onClick={() => setLocation(item.path)}
                data-testid={`breadcrumb-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Breadcrumbs.Item>
              {index < breadcrumbs.length - 1 && <Breadcrumbs.Divider key={`divider-${index}`} />}
            </>
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
