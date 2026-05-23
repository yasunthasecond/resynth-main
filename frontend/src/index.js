import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const root = createRoot(document.getElementById("root"));
root.render(
  <ClerkProvider 
    publishableKey={PUBLISHABLE_KEY} 
    afterSignOutUrl="/"
    appearance={{
      variables: {
        colorPrimary: '#10b981', // emerald-500
        colorBackground: '#10131a',
        colorInputBackground: 'rgba(255, 255, 255, 0.03)',
        colorInputText: '#fff',
        colorText: '#fff',
        colorTextSecondary: '#94a3b8',
        colorShimmer: 'rgba(255,255,255,0.1)'
      },
      elements: {
        card: "border border-white/[0.08] shadow-none bg-[#10131a]",
        headerTitle: "text-white",
        headerSubtitle: "text-slate-400",
        formFieldLabel: "text-slate-300",
        formButtonPrimary: "bg-emerald-500 hover:bg-emerald-400 text-[#0a0c10] font-semibold",
        footerActionText: "text-slate-400",
        footerActionLink: "text-emerald-500 hover:text-emerald-400",
        userButtonPopoverCard: "bg-[#10131a] border border-white/[0.08] text-white shadow-2xl",
        userButtonPopoverActionButton: "hover:bg-white/[0.04]",
        userButtonPopoverActionButtonText: "text-slate-200",
        userButtonPopoverActionButtonIcon: "text-slate-400",
        userPreviewMainIdentifier: "text-white font-semibold",
        userPreviewSecondaryIdentifier: "text-slate-400",
        formFieldInput: "bg-[#10131a] text-white border-white/[0.2] focus:border-emerald-500",
        socialButtonsBlockButton: "text-white border-white/[0.2] hover:bg-white/[0.04]",
        socialButtonsBlockButtonText: "text-white font-semibold",
        dividerLine: "bg-white/[0.1]",
        dividerText: "text-slate-400",
        formFieldSuccessText: "text-emerald-500",
        formFieldErrorText: "text-red-400",
        identityPreviewText: "text-white",
        identityPreviewEditButton: "text-emerald-500 hover:text-emerald-400",
      }
    }}
  >
    <App />
  </ClerkProvider>
);
