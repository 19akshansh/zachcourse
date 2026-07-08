import React, { useEffect, useState } from "react";
import { trpc } from "../lib/trpc-client";
import { Trophy, Download, Award, Loader2, Home, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PublicCertificatePageProps {
  certId: string;
}

export const PublicCertificatePage: React.FC<PublicCertificatePageProps> = ({ certId }) => {
  const { t, i18n } = useTranslation(["certificate"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<any>(null);

  useEffect(() => {
    if (!certId) {
      setError(t("noCertId", { defaultValue: "No certificate ID provided." }));
      setLoading(false);
      return;
    }

    setLoading(true);
    trpc.getCertificateByCertId.query({ certId })
      .then((data) => {
        setCertificate(data);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error("Error fetching certificate:", err);
        setError(err.message || t("certNotFound", { defaultValue: "Certificate not found." }));
        setLoading(false);
      });
  }, [certId, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0D19] flex flex-col items-center justify-center text-[#CECADF] p-6 text-center">
        <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-tight">{t("retrievingCert", { defaultValue: "Retrieving Certificate..." })}</h2>
        <p className="text-sm text-[#8E88AB] mt-1 font-medium">{t("verifyingCredentials", { defaultValue: "Verifying credentials from ZachCourse database." })}</p>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-[#0F0D19] flex flex-col items-center justify-center text-[#CECADF] p-6 text-center">
        <div className="w-16 h-16 bg-red-950/20 text-red-400 flex items-center justify-center rounded-2xl border border-red-500/20 mb-4 shadow-lg">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{t("invalidCert", { defaultValue: "Invalid Certificate" })}</h2>
        <p className="text-[#8E88AB] mt-2 max-w-md font-medium text-sm">
          {error || t("invalidCertDesc", { defaultValue: "The certificate ID you are trying to access does not exist or has been modified." })}
        </p>
        <button
          onClick={() => { window.location.href = "/"; }}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[#1E1A33] hover:bg-[#2A2443] text-white rounded-xl text-sm font-bold transition-all border border-[#2A2443]"
        >
          <Home className="w-4 h-4" />
          {t("goToHome", { defaultValue: "Go to Home" })}
        </button>
      </div>
    );
  }

  const formattedDate = new Date(certificate.completionDate).toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0F0D19] text-[#CECADF] flex flex-col overflow-x-hidden print:bg-white print:text-black">
      <style>
        {`
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body > *:not(.print-wrapper) {
              display: none !important;
            }
            .print-wrapper {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: 100% !important;
              background: white !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .print-content-wrapper {
              display: flex !important;
              height: 100% !important;
              min-height: 100vh !important;
              width: 100% !important;
              border: 16px solid #1A172E !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: landscape;
              margin: 0;
            }
          }
        `}
      </style>

      {/* Navigation Header (hidden in print) */}
      <header className="no-print bg-[#131124] border-b border-[#2A2443] py-4 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { window.location.href = "/"; }}>
          <span className="text-xl group-hover:scale-110 transition-transform duration-200">🎓</span>
          <span className="font-display font-black text-white text-lg tracking-tight uppercase group-hover:text-[#4F46E5] transition-colors duration-200">
            Zach<span className="text-[#4F46E5] group-hover:text-white transition-colors duration-200">Course</span>
          </span>
          <span className="bg-[#1E1A33] border border-[#2A2443] text-[#8E88AB] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider hidden sm:inline">
            {t("verificationCore", { defaultValue: "Verification Core" })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E1A33] hover:bg-[#2A2443] text-[#FAF9FD] rounded-xl text-sm font-bold transition-all border border-[#2A2443]"
          >
            <span>{t("platform", { defaultValue: "Platform" })}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-6xl mx-auto w-full print:p-0 print:max-w-none print:w-full">
        {/* Certificate Section */}
        <div className="print-wrapper w-full bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none flex flex-col aspect-auto sm:aspect-[2/1] max-w-[640px] border border-[#2A2443]/10">
          
          {/* Desktop & Print Layout */}
          <div className="hidden sm:flex print-content-wrapper p-6 md:p-8 flex-1 flex-col justify-between relative bg-white border-[8px] md:border-[10px] border-[#1A172E] print:border-[#1A172E] print:min-h-screen print:flex">
            {/* Background Accents */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-br-[60px]" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-tl-[60px]" />
               
            <div className="relative z-10 text-center flex-1 flex flex-col justify-between">
              {/* Header block */}
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1A172E] tracking-tight uppercase" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  {t("title", { defaultValue: "Certificate of Completion" })}
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-semibold mt-1">
                  {t("learningPlatform", { defaultValue: "ZachCourse Learning Platform" })}
                </p>
              </div>

              {/* Recipient block */}
              <div className="py-2.5 my-2 border-y border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t("thisCertifiesThat", { defaultValue: "This certifies that" })}</p>
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-indigo-600 leading-tight">{certificate.userName}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                  {t("forCompleting", { defaultValue: "has successfully completed the course" })}
                </p>
              </div>

              {/* Course Title & Metadata block */}
              <div className="flex flex-col justify-between flex-1">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-[#1A172E] max-w-lg mx-auto leading-snug line-clamp-2">
                  {certificate.courseTitle}
                </h3>
                  
                <div className="flex items-center justify-between w-full max-w-lg mx-auto pt-2.5 border-t border-slate-100 text-left mt-auto">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t("dateCompleted", { defaultValue: "Date Completed" })}</p>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-800">{formattedDate}</p>
                  </div>
                     
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t("certId", { defaultValue: "Certificate ID" })}</p>
                    <p className="text-[11px] sm:text-xs font-mono font-bold text-indigo-600 tracking-wider">{certificate.certId}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile View Placeholder */}
          <div className="flex sm:hidden no-print p-8 flex-col items-center justify-center text-center space-y-4 bg-slate-50 flex-1 print:hidden">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-full mb-4 shadow-lg">
               <Trophy className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{t("certVerified", { defaultValue: "Certificate Verified!" })}</h3>
            <p className="text-slate-600 text-sm max-w-[280px] leading-relaxed">
              <strong>{certificate.userName}</strong> {t("hasSuccessfullyCompletedSimple", { defaultValue: "has successfully completed" })} <strong>{certificate.courseTitle}</strong> {t("onZachCourse", { defaultValue: "on ZachCourse!" })}
            </p>
            <div className="w-full border-t border-slate-200 pt-4 mt-2 text-left space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("recipientName", { defaultValue: "Recipient Name" })}</p>
                <p className="text-sm font-bold text-slate-800">{certificate.userName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("dateCompleted", { defaultValue: "Date Completed" })}</p>
                <p className="text-sm font-bold text-slate-800">{formattedDate}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("certId", { defaultValue: "Certificate ID" })}</p>
                <p className="text-sm font-mono font-bold text-indigo-600 tracking-wider">{certificate.certId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Download Action Button Below Certificate Card */}
        <div className="no-print mt-6 w-full flex justify-center px-4">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-[#4F46E5]/20 hover:scale-[1.02] active:scale-95 duration-200 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            <span>{t("downloadPdf", { defaultValue: "Download Certificate (PDF)" })}</span>
          </button>
        </div>
      </main>

      <footer className="no-print mt-auto py-6 text-center text-xs text-[#8E88AB] border-t border-[#131124]">
        <p>{t("footerText", { year: new Date().getFullYear(), defaultValue: "© {{year}} ZachCourse. All rights reserved. Secured with cryptographic credentials verification.", interpolation: { escapeValue: false } })}</p>
      </footer>
    </div>
  );
};
