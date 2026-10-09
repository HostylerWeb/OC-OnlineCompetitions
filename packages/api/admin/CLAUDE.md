# @oc/api-client-next

Centralized API access: TanStack Query hooks, Better Auth client, Zustand stores, and Axios instance for `apps/admin` (Next.js) and `apps/client` (Vike).

## API client

- `api` — Axios instance, `withCredentials: true` (cookie auth)
- `authClient` — Better Auth React client
- `ApiResponseError`, timeout presets (`checkoutRequestOptions`, `adminInstantPrizeAssignPostOptions`)
- **No JWT header injection.** Session is cookie-based.

## Auth

- `useAuthStore`, `AuthProvider`, `refreshAuthSession`
- `isAdminUser`, `isVerifiedUser`, `isAnonymousUser` from `auth/session.ts`
- Forms: `SignInForm`, `SignUpForm`, `VerifyEmailForm`, `ForgotPasswordForm`, `ResetPasswordForm`

## Stores (Zustand)

- `useCart` — cart management
- `useCheckout` — checkout flow state
- `usePayPalStore` — PayPal UI state
- `useDnaStore` — DNA Payments UI state
- `useStripeStore` — Stripe UI state

## Query keys

`queryKeys` — typed factories in `keys.ts` for consistent TanStack Query cache management.

## Hooks

**Public:** `useCompetitions`, `useCompetitionDetail`, `useCategories`, `useWinners`, `usePaymentConfig`

**User:** `useMyProfile`, `useMyOrders`, `useMyEntries`, `usePaymentSession`, `useCreateCheckoutSession`, `useCapturePaymentSession`

**Admin:** `useAdminCompetitions`, `useAdminOrders`, `useAdminUsers`, `useAdminWinners`, `useAdminDashboardStats`, etc.

## Base URL

`process.env.NEXT_PUBLIC_APP_URL` — throws if unset. No silent default.

## 401 handling

Axios response interceptor redirects to login for protected routes; auth funnel paths are excluded.

## Response shape

```typescript
const res = await api.get<T>("/api/foo");
// res is ApiResponse<T>
```
