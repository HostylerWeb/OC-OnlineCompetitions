import type { ProfileAddress } from "@oc/types";
import { cn } from "@oc/utils";
import { Combobox } from "@/components/ui/combobox";
import { COUNTRIES } from "@/components/ui/countries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";

export interface AddressFormFieldsProps {
  value: ProfileAddress;
  onChange: (field: keyof ProfileAddress, value: string) => void;
  idPrefix?: string;
  required?: boolean;
  className?: string;
}

export function AddressFormFields({
  value,
  onChange,
  idPrefix = "",
  required = false,
  className,
}: AddressFormFieldsProps) {
  const { t } = useTranslation();
  const id = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);
  const requiredMarker = required ? <span className="text-red-400"> *</span> : null;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id("addressLine1")}>
          {t("addressForm.addressLine1")}
          {requiredMarker}
        </Label>
        <Input
          id={id("addressLine1")}
          placeholder={t("addressForm.address1Placeholder")}
          value={value.addressLine1}
          onChange={(e) => onChange("addressLine1", e.target.value)}
          className="h-9"
          autoComplete="address-line1"
          required={required}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id("addressLine2")}>{t("addressForm.addressLine2")}</Label>
        <Input
          id={id("addressLine2")}
          placeholder={t("addressForm.address2Placeholder")}
          value={value.addressLine2 ?? ""}
          onChange={(e) => onChange("addressLine2", e.target.value)}
          className="h-9"
          autoComplete="address-line2"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("city")}>
          {t("addressForm.city")}
          {requiredMarker}
        </Label>
        <Input
          id={id("city")}
          placeholder={t("addressForm.cityPlaceholder")}
          value={value.city}
          onChange={(e) => onChange("city", e.target.value)}
          className="h-9"
          autoComplete="address-level2"
          required={required}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("postcode")}>
          {t("addressForm.postcode")}
          {requiredMarker}
        </Label>
        <Input
          id={id("postcode")}
          placeholder={t("addressForm.postcodePlaceholder")}
          value={value.postcode}
          onChange={(e) => onChange("postcode", e.target.value)}
          className="h-9"
          autoComplete="postal-code"
          required={required}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={id("country")}>{t("addressForm.country")}</Label>
        <Combobox
          options={COUNTRIES}
          value={value.country}
          onValueChange={(nextValue) => onChange("country", nextValue)}
          placeholder={t("addressForm.countryPlaceholder")}
          searchPlaceholder={t("addressForm.countrySearchPlaceholder")}
          className="h-9"
        />
      </div>
    </div>
  );
}
