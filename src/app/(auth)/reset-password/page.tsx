import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Lock, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { authClient } from "../../../lib/auth-client";
import { navigate } from "../../../lib/router";
import { toast } from "sonner";

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(2);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const passwordVal = watch("password", "");

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: "", color: "bg-[#1E1E2E]" };
    if (pass.length < 6) return { score: 1, text: "Weak", color: "bg-rose-500 w-1/3" };

    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const hasUppercase = /[A-Z]/.test(pass);
    const hasLowercase = /[a-z]/.test(pass);

    if (pass.length >= 8 && hasLetters && hasNumbers && hasSpecial && hasUppercase && hasLowercase) {
      return { score: 3, text: "Strong", color: "bg-emerald-500 w-full" };
    }
    if (pass.length >= 6 && hasLetters && hasNumbers) {
      return { score: 2, text: "Medium", color: "bg-amber-500 w-2/3" };
    }
    return { score: 1, text: "Weak", color: "bg-rose-500 w-1/3" };
  };

  const strength = getPasswordStrength(passwordVal);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setGlobalError("");
    try {
      // Better Auth handles the token automatically from the query string
      const res = await (authClient as any).resetPassword({
        newPassword: data.password,
      });
      if (res?.error) {
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("expire") || msg.includes("token") || msg.includes("invalid")) {
          toast.error("This reset link has expired — request a new one");
        } else {
          toast.error(res.error.message || "Failed to reset your password.");
        }
        setGlobalError(res.error.message || "Failed to reset your password.");
      } else {
        toast.success("Password updated! Redirecting to sign in...");
        setSuccess(true);
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("expire") || msg.includes("token") || msg.includes("invalid")) {
        toast.error("This reset link has expired — request a new one");
      } else {
        toast.error(err.message || "Connection issue — please try again");
      }
      setGlobalError(err.message || "Failed to reset your password.");
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer redirect
  useEffect(() => {
    if (success) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            navigate("/sign-in");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [success]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#111118] border border-[#1E1E2E] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
           style={{ boxShadow: "0 0 40px rgba(99,102,241,0.15)" }}>
        {/* Glow Effect Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#6366F1]/10 rounded-full blur-3xl pointer-events-none"></div>

        {!success ? (
          <div>
            <div className="text-center mb-8 relative">
              <span className="text-4xl select-none">🔒</span>
              <h2 className="text-2xl font-extrabold text-[#FAF9FD] tracking-tight mt-3">Reset Password</h2>
              <p className="text-sm text-[#8E88AB] mt-1 font-medium">Choose a strong, memorable new password</p>
            </div>

            {globalError && (
              <div className="mb-5 text-xs text-rose-400 bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-xl font-medium">
                {globalError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative">
              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-3 pl-10 pr-10 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-medium"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E88AB]/50 hover:text-[#FAF9FD] transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength meter */}
                {passwordVal && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="h-1.5 w-full bg-[#1E1E2E] rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${strength.color}`} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="text-[#8E88AB]">Password Strength:</span>
                      <span className={
                        strength.text === "Weak" ? "text-rose-400" :
                        strength.text === "Medium" ? "text-amber-400" : "text-emerald-400"
                      }>
                        {strength.text}
                      </span>
                    </p>
                  </div>
                )}

                {errors.password && (
                  <p className="mt-1.5 text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠</span> {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-[#CECADF] uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E88AB]/50">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-[#1A1A2E] border border-[#1E1E2E] rounded-xl py-3 pl-10 pr-10 text-sm text-[#FAF9FD] placeholder:text-[#8E88AB]/30 focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all font-medium"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E88AB]/50 hover:text-[#FAF9FD] transition"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <span>⚠</span> {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:from-[#5053e3] hover:to-[#4338CA] active:scale-[0.985] text-white font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-indigo-600/25 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Resetting password...</span>
                  </>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-6 relative">
            <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/15">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-extrabold text-[#FAF9FD] tracking-tight mb-3">Password updated!</h2>
            <p className="text-sm text-[#8E88AB] leading-relaxed max-w-xs mx-auto mb-6 font-medium">
              Your password has been reset successfully.
            </p>
            <p className="text-xs text-[#8E88AB] font-medium">
              Redirecting to sign in page in <span className="text-[#818CF8] font-bold">{countdown}</span> seconds...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
