import type { AiPersonalisationSettings } from "@oc/types";

export function isOpenRouterApiKeyConfigured(
  settings: AiPersonalisationSettings | undefined
): boolean {
  if (!settings) return false;
  if (settings.openRouterApiKeyConfigured) return true;
  return Boolean(settings.openRouterApiKey?.trim());
}

function settingsLoadBlockReason(
  settings: AiPersonalisationSettings | undefined,
  isLoading: boolean
): string | null {
  if (isLoading) return "Loading AI settings…";
  if (!settings) return "Could not load AI settings.";
  return null;
}

/** Text “Optimize description” — OpenRouter key only (uses text model from addon settings). */
export function getDescriptionEnhancementBlockReason(
  settings: AiPersonalisationSettings | undefined,
  isLoading: boolean
): string | null {
  const load = settingsLoadBlockReason(settings, isLoading);
  if (load) return load;
  if (!isOpenRouterApiKeyConfigured(settings)) {
    return "Add your OpenRouter API key under Addons → OpenRouter AI → Customer personalisation.";
  }
  return null;
}

/** Image “Generate with AI” — requires image generation to be enabled in addon settings. */
export function getImageGenerationBlockReason(
  settings: AiPersonalisationSettings | undefined,
  isLoading: boolean
): string | null {
  const load = settingsLoadBlockReason(settings, isLoading);
  if (load) return load;
  if (!isOpenRouterApiKeyConfigured(settings)) {
    return "Add your OpenRouter API key under Addons → OpenRouter AI → Customer personalisation.";
  }
  if (!settings!.imageGenerationEnabled) {
    return "Turn on “Enable image generation on competition form” under Addons → OpenRouter AI → Image generation, then Save.";
  }
  return null;
}
