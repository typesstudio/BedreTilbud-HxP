import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";

export default function UserSelector() {
  const [, setLocation] = useLocation();
  const currentUserId = localStorage.getItem("userId");

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const handleUserChange = (userId: string) => {
    localStorage.setItem("userId", userId);
    window.location.reload();
  };

  const handleNewUser = () => {
    localStorage.removeItem("userId");
    setLocation("/onboarding");
  };

  const currentUser = (users as any[]).find((u: any) => u.id === currentUserId);
  const displayName = currentUser?.name || currentUser?.email || "Vælg bruger";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 min-w-[180px] justify-between"
          data-testid="user-selector"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{displayName}</span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>Skift bruger</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(users as any[]).length > 0 ? (
          <>
            {(users as any[]).map((user: any) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => handleUserChange(user.id)}
                className="cursor-pointer"
                data-testid={`user-option-${user.id}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{user.name || user.email}</span>
                  {user.name && <span className="text-xs text-muted-foreground">{user.email}</span>}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuItem disabled className="text-muted-foreground">
            Ingen brugere fundet
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={handleNewUser}
          className="cursor-pointer font-medium"
          data-testid="button-new-user"
        >
          + Opret ny bruger
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
