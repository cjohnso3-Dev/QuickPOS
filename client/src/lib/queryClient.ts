import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
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
    // Construct the URL from the queryKey array
    const url = queryKey.join('/'); // Join all elements with '/'

    // Client-side logging for /api/users/:id/time-clocks
    if (url.includes('/api/users/') && url.includes('/time-clocks')) {
      const parts = url.split('/');
      const userIdIndex = parts.indexOf('users') + 1;
      if (userIdIndex > 0 && userIdIndex < parts.length) {
        const loggedUserId = parts[userIdIndex];
        console.log(`[DEBUG] Client-side: Attempting to fetch time clocks for user ID: ${loggedUserId}, URL: ${url}`);
      }
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);

    const contentType = res.headers.get('Content-Type');
    const responseText = await res.clone().text(); // Clone to read text, as body can only be read once

    // Log response details
    console.log(
      `[DEBUG] Fetch Response for URL: ${url}\nStatus: ${res.status}\nContent-Type: ${contentType}\nResponse Text (first 500 chars): ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`
    );

    if (contentType && contentType.includes('application/json')) {
      try {
        // Attempt to parse as JSON only if content type is correct
        return JSON.parse(responseText); // Use the already read text
      } catch (e) {
        console.error(`[DEBUG] Failed to parse JSON response for ${url} despite Content-Type being application/json. Error: ${(e as Error).message}. Response text: ${responseText.substring(0, 500)}`);
        throw new Error(`Failed to parse JSON response from ${url}. Error: ${(e as Error).message}. Ensure the API returns valid JSON.`);
      }
    } else {
      // If not JSON, throw a specific error
      const errorMsg = `Expected JSON response from ${url} but received Content-Type: ${contentType || 'N/A'}. Response body (first 200 chars): ${responseText.substring(0,200)}`;
      console.error(`[DEBUG] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
