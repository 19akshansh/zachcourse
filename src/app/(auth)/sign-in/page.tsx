import React from "react";
import SignInForm from "../../../features/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <SignInForm />
    </div>
  );
}
