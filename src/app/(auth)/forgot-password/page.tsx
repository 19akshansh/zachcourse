import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { authClient } from "../../../lib/auth-client";
import { navigate } from "../../../lib/router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const schema = z.object({
  email: z.string().min(1, "emailRequired").email("invalidEmail"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation(["auth"]);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setGlobalError("");
    try {
      const res = await (authClient as any).requestPasswordReset({
        email: data.email,
        redirectTo: window.location.origin + "/reset-password",
      });
      if (res?.error) {
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("user not found") || msg.includes("not exist") || msg.includes("email_not_found")) {
          toast.success(t("resetLinkSent"));
          setSuccess(true);
        } else {
          toast.error(res.error.message || t("failedPasswordReset"));
          setGlobalError(res.error.message || t("failedPasswordReset"));
        }
      } else {
        toast.success(t("resetLinkSent"));
        setSuccess(true);
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("user not found") || msg.includes("not exist") || msg.includes("email_not_found")) {
        toast.success(t("resetLinkSent"));
        setSuccess(true);
      } else {
        toast.error(err.message || t("connectionIssue"));
        setGlobalError(err.message || t("failedPasswordReset"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
           style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
        {/* Glow Effect Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#4F46E5]/10 rounded-full blur-3xl pointer-events-none"></div>

        {!success ? (
          <div>
            <div className="text-center mb-8 relative">
              <span className="text-4xl select-none">🔑</span>
              <h2 className="text-2xl font-extrabold text-[#FAF9FD] tracking-tight mt-3">{t("forgotPasswordTitle")}</h2>
              <p className="text-sm text-[#8E88AB] mt-1 font-medium">{t("forgotPasswordSubtitle")}</p>
            </div>

            {globalError && (
              <div className="mb-5 text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-xl font-medium">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative">
              <div>
                <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-2">
                  {t("emailAddress")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder={t("emailPlaceholder", { defaultValue: "you@example.com" })}
                    className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-3 pl-10 pr-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all font-medium"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠</span> {t(errors.email.message as any)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#4F46E5] to-[#4338CA] hover:from-[#4338CA] hover:to-[#4338CA] active:scale-[0.985] text-white font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-indigo-600/25 disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{t("sendingLink")}</span>
                  </>
                ) : (
                  t("sendResetLink")
                )}
              </button>
            </form>

            <div className="mt-6 text-center relative space-y-2">
              <div>
                <a
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8E88AB] hover:text-[#FAF9FD] transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("backToSignIn")}
                </a>
              </div>
              <p className="text-xs text-[#8E88AB] font-medium">
                {t("newHere")}{" "}
                <a href="/sign-up" className="text-[#818CF8] hover:text-[#4F46E5] font-bold transition">
                  {t("createNewAccount")}
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 relative">
            <div className="w-16 h-16 bg-[#4F46E5]/10 border border-[#4F46E5]/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#4F46E5]/15">
              <span className="text-3xl select-none">✉️</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-3">{t("checkYourInbox")}</h2>
            <p className="text-sm text-[#8E88AB] leading-relaxed max-w-xs mx-auto mb-6 font-medium">
              {t("checkInboxDesc")}
            </p>
            <p className="text-xs text-[#8E88AB]/70 max-w-xs mx-auto mb-8 font-medium">
              {t("checkInboxSpamDesc")}
            </p>
            <button
              onClick={() => navigate("/sign-in")}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#818CF8] hover:text-[#4F46E5] transition"
            >
              <ArrowLeft className="w-4 h-4" /> {t("returnToSignIn")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
