import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// CSRF token management
let csrfToken: string | null = null;
let csrfTokenExpiry: number = 0;

async function getCSRFToken(): Promise<string | null> {
  // Return cached token if still valid
  if (csrfToken && Date.now() < csrfTokenExpiry) {
    return csrfToken;
  }
  
  const userId = localStorage.getItem("userId");
  if (!userId) {
    return null;
  }
  
  try {
    const response = await fetch('/api/csrf-token', {
      headers: { 'X-User-ID': userId },
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      // Tokens are valid for 1 hour, refresh after 50 minutes
      csrfTokenExpiry = Date.now() + (50 * 60 * 1000);
      return csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
  
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isFormData = data instanceof FormData;
  
  // Get userId from localStorage for authentication
  const userId = localStorage.getItem("userId");
  
  // Build headers
  const headers: HeadersInit = isFormData ? {} : (data ? { "Content-Type": "application/json" } : {});
  
  // Add X-User-ID header for authentication if userId exists
  if (userId) {
    (headers as Record<string, string>)["X-User-ID"] = userId;
  }
  
  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const token = await getCSRFToken();
    if (token) {
      (headers as Record<string, string>)["X-CSRF-Token"] = token;
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get userId from localStorage for authentication
    const userId = localStorage.getItem("userId");
    
    // Build headers
    const headers: HeadersInit = {};
    if (userId) {
      (headers as Record<string, string>)["X-User-ID"] = userId;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Smart retry logic: only retry on network errors or 5xx server errors
// Don't retry on 4xx client errors (bad request, unauthorized, etc.)
const shouldRetry = (failureCount: number, error: Error): boolean => {
  // Max 3 retries
  if (failureCount >= 3) return false;
  
  // Network errors (no response) - retry
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return true;
  }
  
  // Server errors (5xx) - retry
  if (error.message.match(/^5\d\d:/)) {
    return true;
  }
  
  // Rate limiting (429) - retry with backoff
  if (error.message.startsWith('429:')) {
    return true;
  }
  
  // Timeout errors - retry
  if (error.message.includes('timeout') || error.message.includes('Timeout')) {
    return true;
  }
  
  // Client errors (4xx except 429) - don't retry
  if (error.message.match(/^4\d\d:/)) {
    // Special handling for 401 - clear userId and redirect to onboarding
    if (error.message.startsWith('401:')) {
      localStorage.removeItem('userId');
      window.location.href = '/onboarding';
    }
    return false;
  }
  
  // Unknown errors - retry once
  return failureCount === 0;
};

// Exponential backoff: 1s, 2s, 4s
const retryDelay = (attemptIndex: number) => {
  return Math.min(1000 * 2 ** attemptIndex, 10000);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: shouldRetry,
      retryDelay: retryDelay,
      // Network timeout: 30 seconds for queries
      networkMode: 'online',
    },
    mutations: {
      retry: shouldRetry,
      retryDelay: retryDelay,
      // Network timeout for mutations
      networkMode: 'online',
    },
  },
});
