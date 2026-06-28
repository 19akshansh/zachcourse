import React from "react";
import SignUpForm from "../../../features/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-6 font-sans">
      <SignUpForm />
    </div>
  );
}
