"use client";

import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {QueryClientProvider} from "@tanstack/react-query";
import {ReactNode, useState} from "react";

import StytchProvider from "@/components/StytchProvider";
import {createAppQueryClient} from "@/lib/query-client";

interface QueryProviderProps {
  children: ReactNode;
}

export default function QueryProvider({children}: QueryProviderProps) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <StytchProvider>{children}</StytchProvider>
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
