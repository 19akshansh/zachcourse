"use client"
import React, { useState, useEffect } from "react";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { authClient } from "../../lib/auth-client";
import { navigate } from "../../lib/router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function SignUpForm() {
  const { t } = useTranslation("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Add logic here if needed for effect
  }, []);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: "", color: "bg-[#1E1E2E]" };
    if (pass.length < 6) return { score: 1, text: t("passwordStrength_Weak", { defaultValue: "Weak" }), color: "bg-rose-500 w-1/3" };

    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const hasUppercase = /[A-Z]/.test(pass);
    const hasLowercase = /[a-z]/.test(pass);

    if (pass.length >= 8 && hasLetters && hasNumbers && hasSpecial && hasUppercase && hasLowercase) {
      return { score: 3, text: t("passwordStrength_Strong", { defaultValue: "Strong" }), color: "bg-emerald-500 w-full" };
    }
    if (pass.length >= 6 && hasLetters && hasNumbers) {
      return { score: 2, text: t("passwordStrength_Medium", { defaultValue: "Medium" }), color: "bg-amber-500 w-2/3" };
    }
    return { score: 1, text: t("passwordStrength_Weak", { defaultValue: "Weak" }), color: "bg-rose-500 w-1/3" };
  };

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      toast.error(t("toastFillAllFields", { defaultValue: "Please fill in all fields" }));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("toastPasswordsDontMatch", { defaultValue: "Passwords don't match" }));
      return;
    }
    if (password.length < 8) {
      toast.error(t("toastPasswordMinLength", { defaultValue: "Password must be at least 8 characters" }));
      return;
    }
    if (!terms) {
      toast.error(t("toastAgreeTerms", { defaultValue: "You must agree to the Terms of Service" }));
      return;
    }

    setLoading(true);
    setGlobalError("");

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      // Destructure safely — Better Auth can return undefined for either
      const data = result?.data;
      const error = result?.error;

      // Log everything for debugging
      console.log("[signup] full result:", JSON.stringify(result));

      if (error) {
        const msg = error.message ?? "";
        const code = (error as any).code ?? "";
        const status = (error as any).status ?? 0;
        
        console.error("[signup] error:", { msg, code, status });

        // USER_ALREADY_EXISTS thrown from our databaseHook
        if (
          msg.includes("USER_ALREADY_EXISTS") ||
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("exists") ||
          msg.toLowerCase().includes("taken") ||
          msg.toLowerCase().includes("registered") ||
          code === "USER_ALREADY_EXISTS" ||
          status === 422
        ) {
          toast.error(t("toastEmailAlreadyRegistered", { defaultValue: "This email is already registered" }), {
            description: t("toastTrySigningIn", { defaultValue: "Try signing in or reset your password." }),
            duration: 8000,
            action: {
              label: t("signInArrow", { defaultValue: "Sign in →" }),
              onClick: () => { window.location.href = "/sign-in"; }
            }
          });
          setGlobalError(t("toastEmailAlreadyRegisteredGeneric", { defaultValue: "This email is already registered — sign in instead." }));
          return;
        }

        // Password too weak
        if (
          msg.toLowerCase().includes("password") &&
          msg.toLowerCase().includes("weak")
        ) {
          toast.error(t("toastPasswordTooWeak", { defaultValue: "Password is too weak — use 8+ chars with numbers" }));
          setGlobalError(msg);
          return;
        }

        toast.error(msg || t("toastSignUpFailed", { defaultValue: "Sign up failed" }));
        setGlobalError(msg || t("toastSomethingWentWrong", { defaultValue: "Something went wrong" }));
        return;
      }

      // Even on apparent success, verify we got a real new user
      // A duplicate with emailVerification returns data but user 
      // may have been created previously — check createdAt
      if (data?.user) {
        const createdAt = new Date((data.user as any).createdAt);
        const now = new Date();
        const secondsAgo = (now.getTime() - createdAt.getTime()) / 1000;
        
        // If user was created more than 30 seconds ago, it's a duplicate
        if (secondsAgo > 30) {
          toast.error(t("toastEmailAlreadyRegistered", { defaultValue: "This email is already registered" }), {
            description: t("toastResentVerificationInbox", { defaultValue: "A verification email was resent. Check your inbox." }),
            duration: 8000,
            action: {
              label: t("signInArrow", { defaultValue: "Sign in →" }),
              onClick: () => { window.location.href = "/sign-in"; }
            }
          });
          setGlobalError(t("toastEmailAlreadyRegisteredSimple", { defaultValue: "This email is already registered." }));
          return;
        }
      }

      if (!data?.user) {
        toast.error(t("toastCouldNotCreateAccount", { defaultValue: "Could not create account — try again" }));
        setGlobalError(t("toastAccountCreationFailed", { defaultValue: "Account creation failed." }));
        return;
      }

      // Genuine new account
      setEmailSent(true);
      toast.success(t("toastAccountCreatedSuccess", { defaultValue: "Account created successfully! 🎉" }), {
        description: t("toastVerifyEmailFirst", { defaultValue: "Please go to your mailbox and verify your email before logging in." }),
        duration: 10000,
        action: {
          label: t("goToSignIn", { defaultValue: "Go to Sign in" }),
          onClick: () => { window.location.href = "/sign-in"; }
        }
      });

    } catch (err: any) {
      console.error("[signup] caught exception:", err);
      // Show the raw error — never swallow it
      const msg = err?.message || err?.toString() || "Unexpected error";
      toast.error(msg, { duration: 6000 });
      setGlobalError(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setLoading(true);
    setGlobalError("");
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: "/dashboard",
        errorCallbackURL: "/sign-in?error=oauth_failed",
      });
      if (res?.error) {
        toast.error(res.error.message || t("failedToAuthenticateWith", { defaultValue: `Failed to authenticate with ${provider}.`, provider }));
        setGlobalError(res.error.message || t("failedToAuthenticateWith", { defaultValue: `Failed to authenticate with ${provider}.`, provider }));
        setLoading(false);
      }
    } catch (err: any) {
      toast.error(err.message || t("connectionIssue", { defaultValue: "Connection issue — please try again" }));
      setGlobalError(err.message || t("failedToAuthenticateWith", { defaultValue: `Failed to authenticate with ${provider}.`, provider }));
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center"
           style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
        {/* Glow Effect Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="py-8 relative flex flex-col items-center">
          {/* Animated Envelope / Checkmark Illustration */}
          <div className="w-20 h-20 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 animate-bounce">
            <Mail className="w-10 h-10 text-emerald-400" />
          </div>

          <h2 className="text-2xl font-extrabold text-[#FAF9FD] tracking-tight mb-3">{t("checkEmailTitle", { defaultValue: "Check your email" })}</h2>
          <p className="text-sm text-[#8E88AB] leading-relaxed max-w-xs mb-6 font-medium">
            {t("checkEmailSubtitle", { defaultValue: "We've sent a verification link to {{email}}. Please click the link in that email to activate your learning portal account.", email })}
          </p>

          <div className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl p-4 text-xs text-[#8E88AB] font-medium leading-relaxed text-left">
            <p>
              {t("cantFindEmail", { defaultValue: "Can't find the email? Check your spam folder, or make sure the email address was entered correctly." })}
            </p>
          </div>

          <a
            href="/sign-in"
            className="mt-8 text-sm font-bold text-[#818CF8] hover:text-[#4F46E5] transition"
          >
            {t("returnToSignIn", { defaultValue: "Return to Sign In →" })}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
         style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
      {/* Glow Effect Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#4F46E5]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="text-center mb-6 relative">
        <span className="text-4xl select-none">🎓</span>
        <h2 className="text-3xl font-extrabold text-[#FAF9FD] tracking-tight mt-3">{t("signUpTitle", { defaultValue: "ZachCourse" })}</h2>
        <p className="text-sm text-[#8E88AB] mt-1 font-medium">{t("createAccountSubtitle", { defaultValue: "Create your learning portal account" })}</p>
      </div>

      {globalError && (
        <div className="mb-5 text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-xl font-medium">
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 relative">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-1.5">
            {t("fullNameLabel", { defaultValue: "Full Name" })}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="signup-name"
              placeholder={t("fullNamePlaceholder", { defaultValue: "Zachary Smith" })}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all font-medium"
            />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-1.5">
            {t("emailLabel", { defaultValue: "Email Address" })}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              id="signup-email"
              placeholder={t("emailPlaceholder", { defaultValue: "you@example.com" })}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-2.5 pl-10 pr-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all font-medium"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-1.5">
            {t("passwordLabel", { defaultValue: "Password" })}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              placeholder={t("passwordPlaceholder", { defaultValue: "••••••••" })}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-2.5 pl-10 pr-10 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E88AB]/50 hover:text-[#FAF9FD] transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Interactive Strength Bar */}
          {password && (
            <div className="mt-2.5 space-y-1.5">
              <div className="h-1.5 w-full bg-[#1E1E2E] rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${strength.color}`} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="text-[#8E88AB]">{t("passwordStrength", { defaultValue: "Password Strength:" })}</span>
                <span className={
                  strength.text === t("passwordStrength_Weak", { defaultValue: "Weak" }) ? "text-rose-400" :
                  strength.text === t("passwordStrength_Medium", { defaultValue: "Medium" }) ? "text-amber-400" : "text-emerald-400"
                }>
                  {strength.text}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-1.5">
            {t("confirmPasswordLabel", { defaultValue: "Confirm Password" })}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="signup-confirm-password"
              placeholder={t("confirmPasswordPlaceholder", { defaultValue: "••••••••" })}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-2.5 pl-10 pr-10 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E88AB]/50 hover:text-[#FAF9FD] transition"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start gap-2.5 py-1">
          <input
            type="checkbox"
            id="terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="w-4 h-4 rounded border-[#1E1E2E] bg-[#1A1A2E] text-[#4F46E5] focus:ring-[#4F46E5]/20 mt-0.5 cursor-pointer accent-[#4F46E5]"
          />
          <label htmlFor="terms" className="text-xs text-[#8E88AB] font-medium leading-relaxed select-none cursor-pointer">
            {t("iAgreeToTerms", { defaultValue: "I agree to the Terms of Service and Privacy Policy" })}
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#4F46E5] to-[#4338CA] hover:from-[#4338CA] hover:to-[#4338CA] active:scale-[0.985] text-white font-bold rounded-xl py-2.5 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-indigo-600/25 disabled:opacity-50 mt-1"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{t("creatingAccountBtn", { defaultValue: "Creating account..." })}</span>
            </>
          ) : (
            t("createAccountBtn", { defaultValue: "Create Account" })
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#1E1E2E]"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#111118] px-3.5 text-[#8E88AB]/60 font-semibold tracking-wider">
            {t("orContinueWith", { defaultValue: "or continue with" })}
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-2 gap-3.5 relative">
        <button
          type="button"
          onClick={() => handleOAuthSignIn("google")}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#1A1A2E] hover:bg-[#20203a] border border-[#1E1E2E] rounded-xl py-2.5 px-3.5 text-xs font-bold text-[#FAF9FD] hover:border-[#4F46E5]/50 cursor-pointer transition disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>{t("google", { defaultValue: "Google" })}</span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuthSignIn("github")}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#1A1A2E] hover:bg-[#20203a] border border-[#1E1E2E] rounded-xl py-2.5 px-3.5 text-xs font-bold text-[#FAF9FD] hover:border-[#4F46E5]/50 cursor-pointer transition disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          <span>{t("github", { defaultValue: "GitHub" })}</span>
        </button>
      </div>

      {/* Switch Page */}
      <div className="mt-6 text-center text-sm text-[#8E88AB] font-medium relative">
        <p>
          {t("alreadyRegistered", { defaultValue: "Already registered?" })}{" "}
          <a
            href="/sign-in"
            className="text-[#818CF8] hover:text-[#4F46E5] font-bold transition"
          >
            {t("signInLink", { defaultValue: "Sign in" })}
          </a>
        </p>
      </div>
    </div>
  );
}
