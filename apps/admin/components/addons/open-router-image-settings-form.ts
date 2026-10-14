import {
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  type AiPersonalisationSettings,
} from "@oc/types";

export type ImageGenerationFormState = {
  enabled: boolean;
  model: string;
  promptTemplate: string;
  brandColors: string;
  referenceUrl: string;
  descriptionModel: string;
};

export function imageGenerationSettingsToFormState(
  settings: AiPersonalisationSettings
): ImageGenerationFormState {
  const template = settings.imageGenerationPromptTemplate;
  return {
    enabled: settings.imageGenerationEnabled,
    model: settings.imageGenerationModel ?? "",
    promptTemplate:
      template !== undefined && template !== ""
        ? template
        : DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
    brandColors: settings.imageGenerationBrandColors ?? "",
    referenceUrl: settings.imageGenerationReferenceImageUrl ?? "",
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
    descriptionEnhancementModel: state.descriptionModel,
  };
}

export const DEFAULT_IMAGE_GENERATION_FORM_STATE: ImageGenerationFormState =
  imageGenerationSettingsToFormState(DEFAULT_AI_PERSONALISATION_SETTINGS);
