import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";


// ar
import arCommon from "../locales/ar/common.json";
import arHeader from "../locales/ar/header.json";
import arTour from "../locales/ar/tour.json";
import arAuth from "../locales/ar/auth.json";
import arMentorChat from "../locales/ar/mentorChat.json";
import arRoadmap from "../locales/ar/roadmap.json";
import arQuizRunner from "../locales/ar/quizRunner.json";
import arProgressDashboard from "../locales/ar/progressDashboard.json";
import arCohorts from "../locales/ar/cohorts.json";
import arTeacherDashboard from "../locales/ar/teacherDashboard.json";
import arAnalytics from "../locales/ar/analytics.json";
import arCertificate from "../locales/ar/certificate.json";
import arPersonalization from "../locales/ar/personalization.json";
import arDocumentUpload from "../locales/ar/documentUpload.json";
import arLanding from "../locales/ar/landing.json";

// en
import enCommon from "../locales/en/common.json";
import enHeader from "../locales/en/header.json";
import enTour from "../locales/en/tour.json";
import enAuth from "../locales/en/auth.json";
import enMentorChat from "../locales/en/mentorChat.json";
import enRoadmap from "../locales/en/roadmap.json";
import enQuizRunner from "../locales/en/quizRunner.json";
import enProgressDashboard from "../locales/en/progressDashboard.json";
import enCohorts from "../locales/en/cohorts.json";
import enTeacherDashboard from "../locales/en/teacherDashboard.json";
import enAnalytics from "../locales/en/analytics.json";
import enCertificate from "../locales/en/certificate.json";
import enPersonalization from "../locales/en/personalization.json";
import enDocumentUpload from "../locales/en/documentUpload.json";
import enLanding from "../locales/en/landing.json";

// es
import esCommon from "../locales/es/common.json";
import esHeader from "../locales/es/header.json";
import esTour from "../locales/es/tour.json";
import esAuth from "../locales/es/auth.json";
import esMentorChat from "../locales/es/mentorChat.json";
import esRoadmap from "../locales/es/roadmap.json";
import esQuizRunner from "../locales/es/quizRunner.json";
import esProgressDashboard from "../locales/es/progressDashboard.json";
import esCohorts from "../locales/es/cohorts.json";
import esTeacherDashboard from "../locales/es/teacherDashboard.json";
import esAnalytics from "../locales/es/analytics.json";
import esCertificate from "../locales/es/certificate.json";
import esPersonalization from "../locales/es/personalization.json";
import esDocumentUpload from "../locales/es/documentUpload.json";
import esLanding from "../locales/es/landing.json";

// fr
import frCommon from "../locales/fr/common.json";
import frHeader from "../locales/fr/header.json";
import frTour from "../locales/fr/tour.json";
import frAuth from "../locales/fr/auth.json";
import frMentorChat from "../locales/fr/mentorChat.json";
import frRoadmap from "../locales/fr/roadmap.json";
import frQuizRunner from "../locales/fr/quizRunner.json";
import frProgressDashboard from "../locales/fr/progressDashboard.json";
import frCohorts from "../locales/fr/cohorts.json";
import frTeacherDashboard from "../locales/fr/teacherDashboard.json";
import frAnalytics from "../locales/fr/analytics.json";
import frCertificate from "../locales/fr/certificate.json";
import frPersonalization from "../locales/fr/personalization.json";
import frDocumentUpload from "../locales/fr/documentUpload.json";
import frLanding from "../locales/fr/landing.json";

// de
import deCommon from "../locales/de/common.json";
import deHeader from "../locales/de/header.json";
import deTour from "../locales/de/tour.json";
import deAuth from "../locales/de/auth.json";
import deMentorChat from "../locales/de/mentorChat.json";
import deRoadmap from "../locales/de/roadmap.json";
import deQuizRunner from "../locales/de/quizRunner.json";
import deProgressDashboard from "../locales/de/progressDashboard.json";
import deCohorts from "../locales/de/cohorts.json";
import deTeacherDashboard from "../locales/de/teacherDashboard.json";
import deAnalytics from "../locales/de/analytics.json";
import deCertificate from "../locales/de/certificate.json";
import dePersonalization from "../locales/de/personalization.json";
import deDocumentUpload from "../locales/de/documentUpload.json";
import deLanding from "../locales/de/landing.json";

// hi
import hiCommon from "../locales/hi/common.json";
import hiHeader from "../locales/hi/header.json";
import hiTour from "../locales/hi/tour.json";
import hiAuth from "../locales/hi/auth.json";
import hiMentorChat from "../locales/hi/mentorChat.json";
import hiRoadmap from "../locales/hi/roadmap.json";
import hiQuizRunner from "../locales/hi/quizRunner.json";
import hiProgressDashboard from "../locales/hi/progressDashboard.json";
import hiCohorts from "../locales/hi/cohorts.json";
import hiTeacherDashboard from "../locales/hi/teacherDashboard.json";
import hiAnalytics from "../locales/hi/analytics.json";
import hiCertificate from "../locales/hi/certificate.json";
import hiPersonalization from "../locales/hi/personalization.json";
import hiDocumentUpload from "../locales/hi/documentUpload.json";
import hiLanding from "../locales/hi/landing.json";

// zh
import zhCommon from "../locales/zh/common.json";
import zhHeader from "../locales/zh/header.json";
import zhTour from "../locales/zh/tour.json";
import zhAuth from "../locales/zh/auth.json";
import zhMentorChat from "../locales/zh/mentorChat.json";
import zhRoadmap from "../locales/zh/roadmap.json";
import zhQuizRunner from "../locales/zh/quizRunner.json";
import zhProgressDashboard from "../locales/zh/progressDashboard.json";
import zhCohorts from "../locales/zh/cohorts.json";
import zhTeacherDashboard from "../locales/zh/teacherDashboard.json";
import zhAnalytics from "../locales/zh/analytics.json";
import zhCertificate from "../locales/zh/certificate.json";
import zhPersonalization from "../locales/zh/personalization.json";
import zhDocumentUpload from "../locales/zh/documentUpload.json";
import zhLanding from "../locales/zh/landing.json";

const resources = {
  ar: {
    common: arCommon,
    header: arHeader,
    tour: arTour,
    auth: arAuth,
    mentorChat: arMentorChat,
    roadmap: arRoadmap,
    quizRunner: arQuizRunner,
    progressDashboard: arProgressDashboard,
    cohorts: arCohorts,
    teacherDashboard: arTeacherDashboard,
    analytics: arAnalytics,
    certificate: arCertificate,
    personalization: arPersonalization,
    documentUpload: arDocumentUpload,
    landing: arLanding,
  },

  en: {
    common: enCommon,
    header: enHeader,
    tour: enTour,
    auth: enAuth,
    mentorChat: enMentorChat,
    roadmap: enRoadmap,
    quizRunner: enQuizRunner,
    progressDashboard: enProgressDashboard,
    cohorts: enCohorts,
    teacherDashboard: enTeacherDashboard,
    analytics: enAnalytics,
    certificate: enCertificate,
    personalization: enPersonalization,
    documentUpload: enDocumentUpload,
    landing: enLanding,
  },
  es: {
    common: esCommon,
    header: esHeader,
    tour: esTour,
    auth: esAuth,
    mentorChat: esMentorChat,
    roadmap: esRoadmap,
    quizRunner: esQuizRunner,
    progressDashboard: esProgressDashboard,
    cohorts: esCohorts,
    teacherDashboard: esTeacherDashboard,
    analytics: esAnalytics,
    certificate: esCertificate,
    personalization: esPersonalization,
    documentUpload: esDocumentUpload,
    landing: esLanding,
  },
  fr: {
    common: frCommon,
    header: frHeader,
    tour: frTour,
    auth: frAuth,
    mentorChat: frMentorChat,
    roadmap: frRoadmap,
    quizRunner: frQuizRunner,
    progressDashboard: frProgressDashboard,
    cohorts: frCohorts,
    teacherDashboard: frTeacherDashboard,
    analytics: frAnalytics,
    certificate: frCertificate,
    personalization: frPersonalization,
    documentUpload: frDocumentUpload,
    landing: frLanding,
  },
  de: {
    common: deCommon,
    header: deHeader,
    tour: deTour,
    auth: deAuth,
    mentorChat: deMentorChat,
    roadmap: deRoadmap,
    quizRunner: deQuizRunner,
    progressDashboard: deProgressDashboard,
    cohorts: deCohorts,
    teacherDashboard: deTeacherDashboard,
    analytics: deAnalytics,
    certificate: deCertificate,
    personalization: dePersonalization,
    documentUpload: deDocumentUpload,
    landing: deLanding,
  },
  hi: {
    common: hiCommon,
    header: hiHeader,
    tour: hiTour,
    auth: hiAuth,
    mentorChat: hiMentorChat,
    roadmap: hiRoadmap,
    quizRunner: hiQuizRunner,
    progressDashboard: hiProgressDashboard,
    cohorts: hiCohorts,
    teacherDashboard: hiTeacherDashboard,
    analytics: hiAnalytics,
    certificate: hiCertificate,
    personalization: hiPersonalization,
    documentUpload: hiDocumentUpload,
    landing: hiLanding,
  },
  zh: {
    common: zhCommon,
    header: zhHeader,
    tour: zhTour,
    auth: zhAuth,
    mentorChat: zhMentorChat,
    roadmap: zhRoadmap,
    quizRunner: zhQuizRunner,
    progressDashboard: zhProgressDashboard,
    cohorts: zhCohorts,
    teacherDashboard: zhTeacherDashboard,
    analytics: zhAnalytics,
    certificate: zhCertificate,
    personalization: zhPersonalization,
    documentUpload: zhDocumentUpload,
    landing: zhLanding,
  }
};

const detectorOptions = {
  order: ["localStorage", "navigator"],
  lookupLocalStorage: "zc_language",
  caches: ["localStorage"],
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    detection: detectorOptions,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    defaultNS: "common",
    parseMissingKeyHandler: (key, defaultValue) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] Missing translation: key='${key}'`);
      }
      return defaultValue || key;
    },
  });

export default i18n;

if (typeof document !== "undefined") {
  document.documentElement.dir = i18n.dir(i18n.language);
}
i18n.on('languageChanged', (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.dir = i18n.dir(lng);
  }
});
