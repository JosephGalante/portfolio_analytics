"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";

import {getCurrentUser, registerUser} from "@/lib/api";
import {
  AuthSession,
  clearStoredAuthSession,
  getStoredAuthSession,
  storeAuthSession,
} from "@/lib/auth";
import StytchAuthPanel from "@/components/StytchAuthPanel";
import {isStytchConfigured} from "@/lib/stytch";

const authQueryKey = ["auth", "me"] as const;

type AuthFormValues = {
  email: string;
  name: string;
  password: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(
    null,
  );
  const {
    formState: {isSubmitting, isValid},
    getValues,
    handleSubmit,
    register,
    reset,
  } = useForm<AuthFormValues>({
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
    mode: "onChange",
    shouldUnregister: true,
  });

  useEffect(() => {
    const storedAuthSession = getStoredAuthSession();

    if (storedAuthSession !== null) {
      setAuthSession(storedAuthSession);
      reset({
        email: storedAuthSession.email,
        name: "",
        password: storedAuthSession.password,
      });
    }

    setAuthChecked(true);
  }, [reset]);

  const currentUserQuery = useQuery({
    queryKey: authQueryKey,
    queryFn: getCurrentUser,
    enabled: authChecked && authSession !== null,
    retry: false,
  });

  useEffect(() => {
    if (
      authSession === null ||
      currentUserQuery.error === null ||
      currentUserQuery.error === undefined
    ) {
      return;
    }

    clearStoredAuthSession();
    setAuthSession(null);
    reset((currentValues) => ({
      ...currentValues,
      password: "",
    }));
    setAuthErrorMessage(
      toErrorMessage(currentUserQuery.error, "Invalid email or password."),
    );
    queryClient.removeQueries({queryKey: authQueryKey});
  }, [authSession, currentUserQuery.error, queryClient, reset]);

  useEffect(() => {
    if (authSession !== null && currentUserQuery.data !== undefined) {
      router.replace("/");
    }
  }, [authSession, currentUserQuery.data, router]);

  useEffect(() => {
    if (authSuccessMessage === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAuthSuccessMessage(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [authSuccessMessage]);

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onMutate: () => {
      setAuthErrorMessage(null);
      setAuthSuccessMessage(null);
    },
    onSuccess: (_, variables) => {
      const nextAuthSession = {
        email: variables.email,
        password: variables.password,
      };

      storeAuthSession(nextAuthSession);
      setAuthSession(nextAuthSession);
      setAuthMode("signin");
      setAuthSuccessMessage(`Registered ${variables.email}.`);
      reset({
        email: variables.email,
        name: "",
        password: variables.password,
      });
      queryClient.removeQueries({queryKey: authQueryKey});
    },
    onError: (error) => {
      setAuthErrorMessage(toErrorMessage(error, "Failed to register user."));
    },
  });

  const isLegacyAuthBusy =
    isSubmitting || registerMutation.isPending || currentUserQuery.isFetching;

  async function handleSignIn(values: AuthFormValues) {
    setAuthErrorMessage(null);
    setAuthSuccessMessage(null);

    const nextAuthSession = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    storeAuthSession(nextAuthSession);
    setAuthSession(nextAuthSession);
    queryClient.removeQueries({queryKey: authQueryKey});
  }

  async function handleRegister(values: AuthFormValues) {
    await registerMutation.mutateAsync({
      email: values.email.trim().toLowerCase(),
      name: values.name.trim(),
      password: values.password,
    });
  }

  if (!authChecked || (authSession !== null && currentUserQuery.isLoading)) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Authenticating your account...</h1>
          <p className="lede">
            Checking your access before loading the dashboard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-grid">
        <div>
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>
            Track portfolios in real time with owned portfolios and live private
            streams.
          </h1>
          <p className="lede">
            {isStytchConfigured
              ? "Email magic-link sign-in now lives here. The backend ownership checks are still on the legacy local auth path until the next migration."
              : "Sign in with HTTP Basic credentials to access only your own portfolios, holdings, valuations, and websocket updates."}
          </p>
        </div>

        {isStytchConfigured ? (
          <StytchAuthPanel />
        ) : (
          <section className="panel auth-panel">
            <div className="panel-header">
              <h2>{authMode === "signin" ? "Sign in" : "Register"}</h2>
              <span>
                {authMode === "signin" ? "Existing user" : "New owner"}
              </span>
            </div>

            {authErrorMessage ? (
              <p className="error-banner">{authErrorMessage}</p>
            ) : null}
            {authSuccessMessage ? (
              <p className="success-banner">{authSuccessMessage}</p>
            ) : null}

            <form
              className="stack-form"
              onSubmit={handleSubmit(
                authMode === "signin" ? handleSignIn : handleRegister,
              )}
            >
              <label>
                <span>Email</span>
                <input
                  autoComplete="username"
                  disabled={isLegacyAuthBusy}
                  {...register("email", {
                    required: true,
                  })}
                  required
                  type="email"
                />
              </label>
              {authMode === "register" ? (
                <label>
                  <span>Name</span>
                  <input
                    disabled={isLegacyAuthBusy}
                    {...register("name", {
                      required: authMode === "register",
                      validate: (value) =>
                        value.trim().length > 0 || "Name is required.",
                    })}
                    required
                  />
                </label>
              ) : null}
              <label>
                <span>Password</span>
                <input
                  autoComplete={
                    authMode === "signin" ? "current-password" : "new-password"
                  }
                  disabled={isLegacyAuthBusy}
                  {...register("password", {
                    minLength: 8,
                    required: true,
                  })}
                  minLength={8}
                  required
                  type="password"
                />
              </label>
              <button disabled={isLegacyAuthBusy || !isValid} type="submit">
                {authMode === "signin"
                  ? isLegacyAuthBusy
                    ? "Signing in..."
                    : "Sign in"
                  : isLegacyAuthBusy
                    ? "Registering..."
                    : "Register"}
              </button>
            </form>

            <button
              className="ghost-button"
              disabled={isLegacyAuthBusy}
              onClick={() => {
                const {email, password} = getValues();

                setAuthErrorMessage(null);
                setAuthSuccessMessage(null);
                setAuthMode(authMode === "signin" ? "register" : "signin");
                reset({
                  email,
                  name: "",
                  password,
                });
              }}
              type="button"
            >
              {authMode === "signin"
                ? "Need an account? Register"
                : "Already have an account? Sign in"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
