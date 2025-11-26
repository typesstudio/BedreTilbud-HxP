import { useQuery } from "@tanstack/react-query";
import type { HealthCheckOverviewViewModel, HealthCheckOverviewApiResponse } from "@/utils/transformHealthCheck";
import { transformHealthCheckOverviewToView } from "@/utils/transformHealthCheck";

export function useHealthCheckOverview(snapshotId: string | undefined) {
  return useQuery<HealthCheckOverviewViewModel>({
    queryKey: ["healthCheckOverview", snapshotId],
    enabled: !!snapshotId,
    queryFn: async () => {
      if (!snapshotId) throw new Error("No snapshot ID");
      
      const userId = localStorage.getItem("userId");
      const headers: HeadersInit = {};
      if (userId) {
        headers["X-User-ID"] = userId;
      }
      
      const res = await fetch(`/api/policies/health-check-overview/by-snapshot/${snapshotId}`, {
        headers,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to load health check overview");
      }
      
      const apiData: HealthCheckOverviewApiResponse = await res.json();
      return transformHealthCheckOverviewToView(apiData);
    },
  });
}
