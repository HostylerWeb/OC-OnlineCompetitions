import {
  HOW_IT_WORKS_ALT_PATHS as HOW_IT_WORKS_ALT_PATHS_EN,
  HOW_IT_WORKS_FEATURES as HOW_IT_WORKS_FEATURES_EN,
  HOW_IT_WORKS_STEPS as HOW_IT_WORKS_STEPS_EN,
} from "@oc/content/how-it-works";
import {
  HowItWorksAltPaths,
  HowItWorksFeatures,
  HowItWorksHero,
  HowItWorksReadyCta,
  HowItWorksSteps,
  HowItWorksSupportCta,
} from "@/components/how-it-works";
import { useTranslation } from "@/lib/i18n";

export default function HowItWorksPage() {
  const { locale } = useTranslation();
  const steps = HOW_IT_WORKS_STEPS_EN;
  const altPaths = HOW_IT_WORKS_ALT_PATHS_EN;
  const features = HOW_IT_WORKS_FEATURES_EN;

  return (
    <div className="oc-container-content pb-6 lg:pb-12 animate-fade-in">
      <div className="py-6 lg:py-16">
        <HowItWorksHero />
        <HowItWorksSteps steps={steps} />
        <HowItWorksAltPaths paths={altPaths} />
        <HowItWorksFeatures features={features} />
        <HowItWorksSupportCta />
        <HowItWorksReadyCta />
      </div>
    </div>
  );
}
