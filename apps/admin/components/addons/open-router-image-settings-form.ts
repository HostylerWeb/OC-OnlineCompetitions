import {
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  DEFAULT_IMAGE_GENERATION_ASPECT_RATIO,
  resolveCompetitionImagePromptTemplate,
  IMAGE_GENERATION_ASPECT_RATIOS,
  type AiPersonalisationSettings,
  type ImageGenerationAspectRatio,
} from "@oc/types";

export type ImageGenerationFormState = {
  enabled: boolean;
  model: string;
  promptTemplate: string;
  brandColors: string;
  referenceUrl: string;
  aspectRatio: ImageGenerationAspectRatio;
  descriptionModel: string;
};

function normalizeAspectRatio(value: string | undefined): ImageGenerationAspectRatio {
  if (value && (IMAGE_GENERATION_ASPECT_RATIOS as readonly string[]).includes(value)) {
    return value as ImageGenerationAspectRatio;
  }
  return DEFAULT_IMAGE_GENERATION_ASPECT_RATIO;
}

export function imageGenerationSettingsToFormState(
  settings: AiPersonalisationSettings
): ImageGenerationFormState {
  return {
    enabled: settings.imageGenerationEnabled,
    model: settings.imageGenerationModel ?? "",
    promptTemplate: resolveCompetitionImagePromptTemplate(settings.imageGenerationPromptTemplate),
    brandColors: settings.imageGenerationBrandColors ?? "",
    referenceUrl: settings.imageGenerationReferenceImageUrl ?? "",
    aspectRatio: normalizeAspectRatio(settings.imageGenerationAspectRatio),
    descriptionModel: settings.descriptionEnhancementModel ?? "",
  };
}

export function imageGenerationFormStateToUpdatePayload(state: ImageGenerationFormState) {
  return {
    imageGenerationEnabled: state.enabled,
    imageGenerationModel: state.model,
    imageGenerationPromptTemplate: state.promptTemplate,
    imageGenerationBrandColors: state.brandColors,
    imageGenerationReferenceImageUrl: state.referenceUrl,
    imageGenerationAspectRatio: state.aspectRatio,
    descriptionEnhancementModel: state.descriptionModel,
  };
}

export const DEFAULT_IMAGE_GENERATION_FORM_STATE: ImageGenerationFormState =
  imageGenerationSettingsToFormState(DEFAULT_AI_PERSONALISATION_SETTINGS);
