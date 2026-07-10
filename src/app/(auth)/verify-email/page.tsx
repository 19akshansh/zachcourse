import React, { useState, useEffect } from "react";
import { Loader2, Check, AlertCircle, Sparkles } from "lucide-react";
import { authClient } from "../../../lib/auth-client";
import { navigate } from "../../../lib/router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setErrorMsg(t("verificationTokenMissing", { defaultValue: "Verification token is missing. Please check your verification link." }));
      toast.error(t("toast.invalidOrExpiredVerificationLink", { defaultValue: "Invalid or expired verification link" }));
      return;
    }

    const doVerification = async () => {
      try {
        const res = await (authClient as any).verifyEmail({
          query: {
            token: token,
          },
        });
        if (res?.error) {
          const msg = res.error.message?.toLowerCase() || "";
          if (msg.includes("already") || msg.includes("already verified") || res.error.code === "EMAIL_ALREADY_VERIFIED") {
            toast.info(t("toast.emailAlreadyVerified", { defaultValue: "Email already verified — signing you in" }));
            setStatus("success");
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          } else {
            toast.error(t("toast.invalidOrExpiredVerificationLink", { defaultValue: "Invalid or expired verification link" }));
            setStatus("error");
            setErrorMsg(res.error.message || t("toast.invalidOrExpiredVerificationLink", { defaultValue: "Invalid or expired verification link" }));
          }
        } else {
          toast.success(t("toast.emailVerifiedWelcome", { defaultValue: "Email verified! Welcome to ZachCourse 🎉" }));
          setStatus("success");
          // Wait 2 seconds and redirect to dashboard
          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
        }
      } catch (err: any) {
        console.error("Verification error:", err);
        const msg = err.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("already verified")) {
          toast.info(t("toast.emailAlreadyVerified", { defaultValue: "Email already verified — signing you in" }));
          setStatus("success");
          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
        } else {
          toast.error(t("toast.invalidOrExpiredVerificationLink", { defaultValue: "Invalid or expired verification link" }));
          setStatus("error");
          setErrorMsg(err.message || t("toast.invalidOrExpiredVerificationLink", { defaultValue: "Invalid or expired verification link" }));
        }
      }
    };

    doVerification();
  }, [t]);

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
           style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
        {/* Glow Effect Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#4F46E5]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center py-6 relative">
          {status === "loading" && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-5" />
              <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-2">{t("verifyingEmailTitle", { defaultValue: "Verifying Email" })}</h2>
              <p className="text-sm text-[#8E88AB] font-medium">{t("verifyingEmailSubtitle", { defaultValue: "Securing and confirming your companion credentials..." })}</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/15 animate-bounce">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-2">{t("emailVerifiedTitle", { defaultValue: "Email verified!" })}</h2>
              <p className="text-sm text-[#8E88AB] mb-5 font-medium">{t("emailVerifiedMessage", { defaultValue: "Your credentials have been successfully confirmed." })}</p>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-500/20 py-2 px-4 rounded-xl">
                <Sparkles className="w-4 h-4" />
                <span>{t("redirectingLabel", { defaultValue: "Redirecting..." })}</span>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-rose-950/40 border border-rose-500/30 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-rose-500/15">
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>
              <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-2">{t("verificationFailedTitle", { defaultValue: "Verification Failed" })}</h2>
              <p className="text-sm text-rose-300 max-w-xs leading-relaxed mb-6 font-medium">{errorMsg}</p>
              
              <button
                onClick={() => navigate("/sign-in")}
                className="bg-gradient-to-r from-[#4F46E5] to-[#4338CA] hover:from-[#4338CA] hover:to-[#4338CA] active:scale-[0.985] text-white font-bold rounded-xl py-2.5 px-6 text-xs transition shadow-lg cursor-pointer"
              >
                {t("goToSignInButton", { defaultValue: "Go to Sign In" })}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
