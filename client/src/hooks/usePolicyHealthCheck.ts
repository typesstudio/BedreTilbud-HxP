import { useQuery } from "@tanstack/react-query";
import type { HealthCheckLayoutProps } from "@/components/health/HealthCheckLayout";
import { transformPolicyHealthCheckToView } from "@/utils/transformHealthCheck";

export function usePolicyHealthCheck(snapshotId: string | undefined) {
  return useQuery<HealthCheckLayoutProps>({
    queryKey: ["policyHealthCheck", snapshotId],
    enabled: !!snapshotId,
    queryFn: async () => {
      if (!snapshotId) throw new Error("No snapshot ID");
      
      // Get userId from localStorage for authentication
      const userId = localStorage.getItem("userId");
      const headers: HeadersInit = {};
      if (userId) {
        headers["X-User-ID"] = userId;
      }
      
      const res = await fetch(`/api/policies/health-check/${snapshotId}`, {
        headers,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to load health check");
      }
      
      const apiData = await res.json();
      return transformPolicyHealthCheckToView(apiData);
    },
  });
}
