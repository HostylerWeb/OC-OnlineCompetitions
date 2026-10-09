import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardMobileContent } from "@/components/layout/DashboardMobileContent";
import { MainShell } from "@/components/layout/MainShell";
import { RequireAccount } from "@/components/auth/RequireAccount";

const HomePage = lazy(() => import("@/pages/index/+Page"));
const LoginPage = lazy(() => import("@/pages/auth/login/+Page"));
const SignUpPage = lazy(() => import("@/pages/auth/sign-up/+Page"));
const VerifyPage = lazy(() => import("@/pages/auth/verify/+Page"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/forgot-password/+Page"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/reset-password/+Page"));
const VerifyMagicLinkPage = lazy(() => import("@/pages/auth/verify-magic-link/+Page"));
const AuthErrorPage = lazy(() => import("@/pages/auth/error/+Page"));
const CompetitionsPage = lazy(() => import("@/pages/competitions/+Page"));
const CompetitionDetailPage = lazy(() => import("@/pages/competitions/@slug/+Page"));
const CartPage = lazy(() => import("@/pages/cart/+Page"));
const CheckoutPage = lazy(() => import("@/pages/checkout/+Page"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout/success/+Page"));
const WinnersPage = lazy(() => import("@/pages/winners/+Page"));
const EntriesPage = lazy(() => import("@/pages/entries/+Page"));
const EntriesDetailPage = lazy(() => import("@/pages/entries/@competitionId/+Page"));
const FaqPage = lazy(() => import("@/pages/faq/+Page"));
const HowItWorksPage = lazy(() => import("@/pages/how-it-works/+Page"));
const AboutPage = lazy(() => import("@/pages/about/+Page"));
const ContactPage = lazy(() => import("@/pages/contact/+Page"));
const TermsPage = lazy(() => import("@/pages/terms/+Page"));
const PrivacyPage = lazy(() => import("@/pages/privacy/+Page"));
const CookiePolicyPage = lazy(() => import("@/pages/cookie-policy/+Page"));
const ResponsiblePlayPage = lazy(() => import("@/pages/responsible-play/+Page"));
const FreePostalEntryPage = lazy(() => import("@/pages/free-postal-entry/+Page"));
const ReferralRedirectPage = lazy(() => import("@/pages/r/@code/+Page"));
const NotFoundPage = lazy(() => import("@/pages/not-found/+Page"));
const AccessDeniedPage = lazy(() => import("@/pages/access-denied/+Page"));

const DashboardHome = lazy(() => import("@/pages/dashboard/+Page"));
const DashboardTickets = lazy(() => import("@/pages/dashboard/tickets/+Page"));
const DashboardOrders = lazy(() => import("@/pages/dashboard/orders/+Page"));
const DashboardWins = lazy(() => import("@/pages/dashboard/wins/+Page"));
const DashboardReferrals = lazy(() => import("@/pages/dashboard/referrals/+Page"));
const DashboardProfile = lazy(() => import("@/pages/dashboard/profile/+Page"));
const DashboardResponsiblePlay = lazy(() => import("@/pages/dashboard/responsible-play/+Page"));

export function AppRoutes() {
  return (
    <Routes>
      {/* Main shell with bottom nav  -  includes auth, cart, checkout */}
      <Route element={<MainShell />}>
        <Route path="/" element={<HomePage />} />

        {/* Auth routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/sign-up" element={<SignUpPage />} />
        <Route path="/auth/verify" element={<VerifyPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-magic-link" element={<VerifyMagicLinkPage />} />
        <Route path="/auth/error" element={<AuthErrorPage />} />

        {/* Cart & checkout */}
        <Route
          path="/cart"
          element={
            <RequireAccount>
              <CartPage />
            </RequireAccount>
          }
        />
        <Route
          path="/checkout"
          element={
            <RequireAccount>
              <CheckoutPage />
            </RequireAccount>
          }
        />
        <Route
          path="/checkout/success"
          element={
            <RequireAccount>
              <CheckoutSuccessPage />
            </RequireAccount>
          }
        />

        {/* Main pages */}
        <Route path="/competitions" element={<CompetitionsPage />} />
        <Route path="/competitions/:slug" element={<CompetitionDetailPage />} />
        <Route path="/entries" element={<EntriesPage />} />
        <Route path="/entries/:competitionId" element={<EntriesDetailPage />} />
        <Route path="/winners" element={<WinnersPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        <Route path="/responsible-play" element={<ResponsiblePlayPage />} />
        <Route path="/free-postal-entry" element={<FreePostalEntryPage />} />
        <Route path="/r/:code" element={<ReferralRedirectPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />

        {/* Dashboard  -  inside main shell with sidebar context */}
        <Route element={<DashboardMobileContent />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/tickets" element={<DashboardTickets />} />
          <Route path="/dashboard/orders" element={<DashboardOrders />} />
          <Route path="/dashboard/wins" element={<DashboardWins />} />
          <Route path="/dashboard/referrals" element={<DashboardReferrals />} />
          <Route path="/dashboard/profile" element={<DashboardProfile />} />
          <Route path="/dashboard/responsible-play" element={<DashboardResponsiblePlay />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
