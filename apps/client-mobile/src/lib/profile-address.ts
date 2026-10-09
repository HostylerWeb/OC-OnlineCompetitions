import type { Profile, ProfileAddress } from "@oc/types";
import { DEFAULT_PROFILE_ADDRESS } from "@oc/types";

type ProfileAddressSource = Pick<
  Profile,
  "addressLine1" | "addressLine2" | "city" | "postcode" | "country"
>;

export function profileAddressFromProfile(profile: ProfileAddressSource): ProfileAddress {
  return {
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    postcode: profile.postcode ?? "",
    country: profile.country ?? DEFAULT_PROFILE_ADDRESS.country,
  };
}

export function getProfileAddressUpdates(
  current: ProfileAddress,
  next: ProfileAddress
): Partial<ProfileAddress> {
  const updates: Partial<ProfileAddress> = {};
  const fields: (keyof ProfileAddress)[] = [
    "addressLine1",
    "addressLine2",
    "city",
    "postcode",
    "country",
  ];

  for (const field of fields) {
    const currentValue = current[field] ?? "";
    const nextValue = next[field] ?? "";
    if (currentValue !== nextValue) {
      updates[field] = nextValue;
    }
  }

  return updates;
}

export function isProfileAddressValid(address: ProfileAddress): boolean {
  return (
    address.addressLine1.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.postcode.trim().length > 0
  );
}
