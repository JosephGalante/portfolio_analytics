"use client";

import {StytchProvider as StytchContextProvider} from "@stytch/nextjs";
import {ReactNode} from "react";

import {stytchClient} from "@/lib/stytch";

interface StytchProviderProps {
  children: ReactNode;
}

export default function StytchProvider({children}: StytchProviderProps) {
  if (stytchClient === null) {
    return <>{children}</>;
  }

  return (
    <StytchContextProvider assumeHydrated={false} stytch={stytchClient}>
      {children}
    </StytchContextProvider>
  );
}
