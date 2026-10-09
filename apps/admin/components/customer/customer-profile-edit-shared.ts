import type { AdminUserProfilePatch, Profile } from "@oc/types";

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  dateOfBirth: "Date of birth",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  postcode: "Postcode",
  country: "Country",
};

export type ProfileFormState = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  marketingConsent: boolean;
};

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  dateOfBirth: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  country: "",
  marketingConsent: false,
};

export function formatDateInputValue(value: string | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function buildProfileFormFromProfile(profile: Profile): ProfileFormState {
  return {
    email: profile.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
    dateOfBirth: formatDateInputValue(profile.dateOfBirth),
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    postcode: profile.postcode ?? "",
    country: profile.country ?? "",
    marketingConsent: profile.marketingConsent ?? false,
  };
}

export function buildProfilePatchFromDiff(
  current: ProfileFormState,
  initial: ProfileFormState
): Omit<AdminUserProfilePatch, "reason"> {
  const patch: Omit<AdminUserProfilePatch, "reason"> = {};

  for (const key of Object.keys(current) as (keyof ProfileFormState)[]) {
    const currentValue =
      key === "dateOfBirth" ? formatDateInputValue(current.dateOfBirth) : current[key];
    const initialValue =
      key === "dateOfBirth" ? formatDateInputValue(initial.dateOfBirth) : initial[key];

    if (currentValue !== initialValue) {
      if (key === "dateOfBirth") {
        patch.dateOfBirth = current.dateOfBirth
          ? new Date(`${current.dateOfBirth}T00:00:00.000Z`).toISOString()
          : undefined;
      } else if (key === "marketingConsent") {
        patch.marketingConsent = current.marketingConsent;
      } else if (key === "email") {
        patch.email = current.email.trim().toLowerCase();
      } else {
        patch[key] = current[key];
      }
    }
  }

  return patch;
}
