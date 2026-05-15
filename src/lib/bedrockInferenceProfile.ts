/**
 * Cross-region inference profiles for Bedrock InvokeModel.
 * Bare `anthropic.*` foundation ids often return 400 for on-demand; AWS expects a
 * geo/global inference profile id (see each model’s Bedrock model card).
 */

export type BedrockGeoKind = 'us' | 'eu' | 'au' | 'jp' | 'apac' | 'global';

const INFERENCE_PROFILE_PREFIX_RE = /^(us|eu|au|jp|apac|global)\.anthropic\./i;

export function inferBedrockGeoKind(awsRegion: string): BedrockGeoKind {
  const r = awsRegion.trim().toLowerCase();
  if (!r) {
    return 'us';
  }
  if (r.startsWith('us-gov-')) {
    return 'us';
  }
  if (r.startsWith('us-') || r.startsWith('ca-')) {
    return 'us';
  }
  if (r.startsWith('eu-')) {
    return 'eu';
  }
  if (r === 'ap-southeast-2' || r === 'ap-southeast-4' || r === 'ap-southeast-6') {
    return 'au';
  }
  if (r === 'ap-northeast-1' || r === 'ap-northeast-3') {
    return 'jp';
  }
  if (r.startsWith('ap-')) {
    return 'apac';
  }
  return 'global';
}

type ProfilePicker = (geo: BedrockGeoKind) => string;

function sonnet46Profile(geo: BedrockGeoKind): string {
  if (geo === 'apac') {
    return 'global.anthropic.claude-sonnet-4-6';
  }
  return `${geo}.anthropic.claude-sonnet-4-6`;
}

function opus46Profile(geo: BedrockGeoKind): string {
  if (geo === 'us' || geo === 'eu' || geo === 'au') {
    return `${geo}.anthropic.claude-opus-4-6-v1`;
  }
  return 'global.anthropic.claude-opus-4-6-v1';
}

function sonnet45Profile(geo: BedrockGeoKind): string {
  if (geo === 'apac') {
    return 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
  }
  return `${geo}.anthropic.claude-sonnet-4-5-20250929-v1:0`;
}

function opus45Profile(geo: BedrockGeoKind): string {
  if (geo === 'us' || geo === 'eu') {
    return `${geo}.anthropic.claude-opus-4-5-20251101-v1:0`;
  }
  return 'global.anthropic.claude-opus-4-5-20251101-v1:0';
}

function haiku45Profile(geo: BedrockGeoKind): string {
  if (geo === 'apac') {
    return 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
  }
  return `${geo}.anthropic.claude-haiku-4-5-20251001-v1:0`;
}

function sonnet4Profile(geo: BedrockGeoKind): string {
  if (geo === 'us' || geo === 'eu') {
    return `${geo}.anthropic.claude-sonnet-4-20250514-v1:0`;
  }
  if (geo === 'apac' || geo === 'au' || geo === 'jp') {
    return 'apac.anthropic.claude-sonnet-4-20250514-v1:0';
  }
  return 'global.anthropic.claude-sonnet-4-20250514-v1:0';
}

const FOUNDATION_TO_CROSS_REGION_PROFILE: Record<string, ProfilePicker> = {
  'anthropic.claude-sonnet-4-6': sonnet46Profile,
  'anthropic.claude-opus-4-6-v1': opus46Profile,
  'anthropic.claude-sonnet-4-5-20250929-v1:0': sonnet45Profile,
  'anthropic.claude-opus-4-5-20251101-v1:0': opus45Profile,
  'anthropic.claude-haiku-4-5-20251001-v1:0': haiku45Profile,
  'anthropic.claude-sonnet-4-20250514-v1:0': sonnet4Profile,
};

/**
 * Returns the `modelId` path segment for `InvokeModel`.
 * Maps known bare Anthropic foundation ids to cross-region inference profile ids from `awsRegion`.
 */
export function resolveBedrockInvokeModelId(modelId: string, awsRegion: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('arn:')) {
    return trimmed;
  }
  if (INFERENCE_PROFILE_PREFIX_RE.test(trimmed)) {
    return trimmed;
  }

  const picker = FOUNDATION_TO_CROSS_REGION_PROFILE[trimmed];
  if (!picker) {
    return trimmed;
  }

  const geo = inferBedrockGeoKind(awsRegion);
  return picker(geo);
}
