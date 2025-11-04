import { NavigationSidebar } from "./NavigationSidebar";

interface AppLayoutWithNavProps {
  children: React.ReactNode;
  userId: string;
}

export function AppLayoutWithNav({ children, userId }: AppLayoutWithNavProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Navigation Sidebar */}
      <div className="hidden md:block">
        <NavigationSidebar userId={userId} />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-default-background">
        {children}
      </div>
    </div>
  );
}
