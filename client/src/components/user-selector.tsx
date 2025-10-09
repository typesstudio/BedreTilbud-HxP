import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
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

  if (!users || users.length === 0) return null;

  const currentUser = (users as any[]).find((u: any) => u.id === currentUserId);

  return (
    <Select value={currentUserId || undefined} onValueChange={handleUserChange}>
      <SelectTrigger className="w-[200px]" data-testid="user-selector">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <SelectValue placeholder="Vælg bruger">
            {currentUser ? (currentUser.name || currentUser.email) : "Vælg bruger"}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {(users as any[]).map((user: any) => (
          <SelectItem key={user.id} value={user.id} data-testid={`user-option-${user.id}`}>
            <div className="flex flex-col">
              <span className="font-medium">{user.name || user.email}</span>
              {user.name && <span className="text-xs text-muted-foreground">{user.email}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
