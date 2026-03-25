"use client";

import {useStytch, useStytchSession} from "@stytch/nextjs";
import {useState} from "react";
import {useForm} from "react-hook-form";

import {getStytchPasswordResetRedirectUrl} from "@/lib/stytch";
import {toErrorMessage} from "@/lib/utils";

type PasswordSignInValues = {
  email: string;
  password: string;
};

type PasswordSetupValues = {
  email: string;
};

export default function StytchAuthPanel() {
  const stytch = useStytch();
  const {isInitialized, session} = useStytchSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const {
    formState: {
      isSubmitting: isPasswordSignInSubmitting,
      isValid: isPasswordSignInValid,
    },
    handleSubmit: handlePasswordSignInSubmit,
    register: registerPasswordSignIn,
  } = useForm<PasswordSignInValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
  });
  const {
    formState: {
      isSubmitting: isPasswordSetupSubmitting,
      isValid: isPasswordSetupValid,
    },
    handleSubmit: handlePasswordSetupSubmit,
    register: registerPasswordSetup,
    reset: resetPasswordSetupForm,
  } = useForm<PasswordSetupValues>({
    defaultValues: {
      email: "",
    },
    mode: "onChange",
  });

  async function handleSignOut() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSigningOut(true);

    try {
      await stytch.session.revoke();
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to sign out of Stytch."));
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handlePasswordSignIn(values: PasswordSignInValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await stytch.passwords.authenticate({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        session_duration_minutes: 60,
      });
      setSuccessMessage("Password sign-in succeeded.");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to sign in."));
    }
  }

  async function handlePasswordSetup(values: PasswordSetupValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await stytch.passwords.resetByEmailStart({
        email: values.email.trim().toLowerCase(),
        reset_password_expiration_minutes: 60,
        reset_password_redirect_url: getStytchPasswordResetRedirectUrl(),
      });
      resetPasswordSetupForm();
      setSuccessMessage(
        "If your account is provisioned, check your email for the password setup link.",
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to send setup email."));
    }
  }

  if (!isInitialized) {
    return (
      <section className="panel auth-panel">
        <div className="panel-header">
          <h2>Password sign-in</h2>
          <span>Stytch</span>
        </div>
        <p className="lede">Loading your Stytch session.</p>
      </section>
    );
  }

  if (session !== null) {
    return (
      <section className="panel auth-panel">
        <div className="panel-header">
          <h2>Stytch connected</h2>
          <span>Password session active</span>
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        {successMessage ? (
          <p className="success-banner">{successMessage}</p>
        ) : null}

        <p className="success-banner">Password session active.</p>
        <p className="lede">
          Your Stytch password session is live. If you do not get redirected,
          sign out and try again or check the backend auth configuration.
        </p>
        <button disabled={isSigningOut} onClick={() => void handleSignOut()}>
          {isSigningOut ? "Signing out..." : "Sign out of Stytch"}
        </button>
      </section>
    );
  }

  return (
    <section className="panel auth-panel">
      <div className="panel-header">
        <h2>{mode === "signin" ? "Sign in" : "Set password"}</h2>
        <span>
          {mode === "signin" ? "Email + password" : "Email confirmation"}
        </span>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      {successMessage ? (
        <p className="success-banner">{successMessage}</p>
      ) : null}

      {mode === "signin" ? (
        <>
          <p className="lede">
            Sign in with the email address and password you set after your
            onboarding email.
          </p>
          <form
            className="stack-form"
            onSubmit={handlePasswordSignInSubmit(handlePasswordSignIn)}
          >
            <label>
              <span>Email</span>
              <input
                autoComplete="username"
                disabled={isPasswordSignInSubmitting}
                {...registerPasswordSignIn("email", {
                  required: true,
                })}
                required
                type="email"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                disabled={isPasswordSignInSubmitting}
                {...registerPasswordSignIn("password", {
                  minLength: 8,
                  required: true,
                })}
                minLength={8}
                required
                type="password"
              />
            </label>
            <button
              disabled={isPasswordSignInSubmitting || !isPasswordSignInValid}
              type="submit"
            >
              {isPasswordSignInSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="lede">
            We’ll send the initial password setup email instead of a login link.
          </p>
          <form
            className="stack-form"
            onSubmit={handlePasswordSetupSubmit(handlePasswordSetup)}
          >
            <label>
              <span>Email</span>
              <input
                autoComplete="username"
                disabled={isPasswordSetupSubmitting}
                {...registerPasswordSetup("email", {
                  required: true,
                })}
                required
                type="email"
              />
            </label>
            <button
              disabled={isPasswordSetupSubmitting || !isPasswordSetupValid}
              type="submit"
            >
              {isPasswordSetupSubmitting
                ? "Sending setup email..."
                : "Email password setup link"}
            </button>
          </form>
        </>
      )}

      <button
        className="ghost-button"
        disabled={isPasswordSignInSubmitting || isPasswordSetupSubmitting}
        onClick={() => {
          setErrorMessage(null);
          setSuccessMessage(null);
          setMode(mode === "signin" ? "setup" : "signin");
        }}
        type="button"
      >
        {mode === "signin"
          ? "Need to set your password?"
          : "Already have a password? Sign in"}
      </button>
    </section>
  );
}
