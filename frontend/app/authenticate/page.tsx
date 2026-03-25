"use client";

import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";

import {isStytchConfigured, stytchClient} from "@/lib/stytch";
import {toErrorMessage} from "@/lib/utils";

type PasswordResetFormValues = {
  confirmPassword: string;
  password: string;
};

export default function AuthenticatePage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const {
    formState: {isSubmitting, isValid},
    getValues,
    handleSubmit,
    register,
  } = useForm<PasswordResetFormValues>({
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  useEffect(() => {
    if (token === undefined) {
      return;
    }

    if (token !== null) {
      setErrorMessage(null);
      return;
    }

    setErrorMessage("Invalid or missing password setup token.");
  }, [token]);

  async function handlePasswordReset(values: PasswordResetFormValues) {
    if (token == null) {
      setErrorMessage("Invalid or missing password setup token.");
      return;
    }

    const passwordResetToken = token;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (values.password !== values.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      await stytchClient?.passwords.resetByEmail({
        password: values.password,
        session_duration_minutes: 60,
        token: passwordResetToken,
      });
      setSuccessMessage("Password set successfully.");
      router.replace("/");
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Failed to set your password."));
    }
  }

  if (!isStytchConfigured) {
    return (
      <main className="shell auth-shell">
        <section className="panel auth-panel">
          <p className="eyebrow">Portfolio Analytics MVP</p>
          <h1>Stytch is required</h1>
          <p className="lede">
            Configure Stytch before using password setup links.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">Portfolio Analytics MVP</p>
        <h1>Set your password</h1>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        {successMessage ? (
          <p className="success-banner">{successMessage}</p>
        ) : null}

        <p className="lede">
          Choose the password you want to use for future sign-ins.
        </p>

        <form
          className="stack-form"
          onSubmit={handleSubmit(handlePasswordReset)}
        >
          <label>
            <span>Password</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting || token === null}
              {...register("password", {
                minLength: 8,
                required: true,
              })}
              minLength={8}
              required
              type="password"
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting || token === null}
              {...register("confirmPassword", {
                minLength: 8,
                required: true,
                validate: (value) =>
                  value === getValues("password") || "Passwords do not match.",
              })}
              minLength={8}
              required
              type="password"
            />
          </label>
          <button
            disabled={isSubmitting || token === null || !isValid}
            type="submit"
          >
            {isSubmitting ? "Saving password..." : "Set password"}
          </button>
        </form>
      </section>
    </main>
  );
}
