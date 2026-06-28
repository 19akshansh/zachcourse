import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { authClient } from "../../../lib/auth-client";
import { navigate } from "../../../lib/router";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
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
      const res = await (authClient as any).forgetPassword({
        email: data.email,
        redirectTo: window.location.origin + "/reset-password",
      });
      if (res?.error) {
        // According to instructions: "Email not found: still show success (security best practice — don't reveal if email exists)"
        // But let's check what kind of error we got. If it's something other than user not found (like network issue), we toast the issue.
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("user not found") || msg.includes("not exist") || msg.includes("email_not_found")) {
          toast.success("Reset link sent! Check your inbox 📬");
          setSuccess(true);
        } else {
          toast.error(res.error.message || "Failed to initiate password reset.");
          setGlobalError(res.error.message || "Failed to initiate password reset.");
        }
      } else {
        toast.success("Reset link sent! Check your inbox 📬");
        setSuccess(true);
      }
    } catch (err: any) {
      // Best practice: if email not found is thrown as exception (or other exception), handle it
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("user not found") || msg.includes("not exist") || msg.includes("email_not_found")) {
        toast.success("Reset link sent! Check your inbox 📬");
        setSuccess(true);
      } else {
        toast.error(err.message || "Connection issue — please try again");
        setGlobalError(err.message || "Failed to initiate password reset.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
           style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
        {/* Glow Effect Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#6366F1]/10 rounded-full blur-3xl pointer-events-none"></div>

        {!success ? (
          <div>
            <div className="text-center mb-8 relative">
              <span className="text-4xl select-none">🔑</span>
              <h2 className="text-2xl font-extrabold text-[#FAF9FD] tracking-tight mt-3">Reset Password</h2>
              <p className="text-sm text-[#8E88AB] mt-1 font-medium">Enter your email and we'll send a secure reset link</p>
            </div>

            {globalError && (
              <div className="mb-5 text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-xl font-medium">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative">
              <div>
                <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-3 pl-10 pr-4 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-medium"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5053e3] hover:to-[#4338CA] active:scale-[0.985] text-white font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-indigo-600/25 disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending link...</span>
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="mt-6 text-center relative space-y-2">
              <div>
                <a
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8E88AB] hover:text-[#FAF9FD] transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </a>
              </div>
              <p className="text-xs text-[#8E88AB] font-medium">
                New here?{" "}
                <a href="/sign-up" className="text-[#818CF8] hover:text-[#6366F1] font-bold transition">
                  Create an account
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 relative">
            <div className="w-16 h-16 bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/15">
              <span className="text-3xl select-none">✉️</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-3">Check your inbox</h2>
            <p className="text-sm text-[#8E88AB] leading-relaxed max-w-xs mx-auto mb-6 font-medium">
              If that email exists, you'll get a link shortly ✉️
            </p>
            <p className="text-xs text-[#8E88AB]/70 max-w-xs mx-auto mb-8 font-medium">
              We've dispatched a password reset link to your registered email address. Please check your promotions or spam folder if it doesn't arrive.
            </p>
            <button
              onClick={() => navigate("/sign-in")}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#818CF8] hover:text-[#6366F1] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
