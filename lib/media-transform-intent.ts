import type { CloudinaryTransformation } from "@/lib/cloudinary";

export type MediaTransformIntent = {
  imageUrl: string;
  transformation: CloudinaryTransformation;
  options?: Record<string, unknown>;
};

const CLOUDINARY_IMAGE_URL_RE =
  /https:\/\/res\.cloudinary\.com\/[^\s)\]]+\/image\/upload\/[^\s)\]]+/i;

// ─── Scene/environment prompt extraction ─────────────────────────────────────

const ENV_PATTERNS: RegExp[] = [
  // "put/place/show/composite this on/in/onto a <scene>"
  /\b(?:put|place|show|render|set|drop|insert|composite|superimpose|move)\s+(?:this|it|the\s+[\w\s]{1,20}?)?\s*(?:on|in|onto|into|against|at|near)\s+(?:a\s+|an\s+|the\s+)?(.+)/i,
  // "transform/convert/turn this into a <style> poster/scene/setting"
  /\b(?:transform|convert|turn|make)\s+(?:this|it|the\s+image|the\s+photo)?\s*(?:into|to)\s+(?:a\s+|an\s+)?(.+)/i,
  // "make it look like / make it cinematic / make it dramatic"
  /\bmake\s+(?:it|this)\s+(?:look\s+)?(?:like\s+(?:a\s+|an\s+)?)?(.+)/i,
  // "change/replace/swap the background to/with <scene>"
  /\b(?:change|replace|swap)\s+(?:the\s+)?background\s+(?:to|with)\s+(?:a\s+|an\s+|the\s+)?(.+)/i,
  // "background should be / as a <scene>"
  /\bbackground\s+(?:should\s+be|as\s+a?|like)\s+(?:a\s+|an\s+|the\s+)?(.+)/i,
  // "make a poster/banner/ad of/with/showing <context>"
  /\bmake\s+(?:a\s+|an\s+)?(?:poster|promo|advertisement|ad|banner|hero\s+shot|promotional\s+(?:image|photo|shot))\s+(?:of|with|for|showing|featuring|in\s+a?)?\s*(.+)/i,
  // "create a cinematic/dramatic/artistic version"
  /\b(?:create|make|generate)\s+(?:a\s+|an\s+)?(?:cinematic|dramatic|artistic|epic|moody|dark|vibrant|vintage|futuristic|neon|studio)\s+(?:version|edit|look|style|shot|photo|image|poster|render)?\s*(?:of\s+(?:this|it))?\s*(.*)/i,
  // "on a <scene>" at end — requires recognizable environment noun
  /\bon\s+(?:a\s+|an\s+|the\s+)?(.+?(?:road|track|street|highway|mountain|desert|beach|city|town|studio|showroom|background|environment|scene|poster|billboard|racetrack|circuit|landscape|skyline|runway|field|forest|space|stage|runway).*)$/i,
  // "in a <scene>" explicitly with scene keywords
  /\bin\s+(?:a\s+|an\s+|the\s+)?(.+?(?:scene|environment|setting|landscape|studio|showroom|city|urban|suburban|rural|outdoor|indoor|background|environment).*)$/i,
];

const NOISE_WORDS_RE = /^(it|this|that|them|here|there|the\s+image|the\s+photo|the\s+picture|me|you|look\s+good|look\s+great|look\s+nice|better|different|cool|awesome)$/i;

function extractScenePrompt(message: string): string | null {
  for (const pattern of ENV_PATTERNS) {
    const match = message.trim().match(pattern);
    if (match?.[1]) {
      const prompt = match[1]
        .replace(/\[Attached image:[^\]]+\]/gi, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[.!?]+$/, "")
        .trim();
      if (prompt.length > 3 && !NOISE_WORDS_RE.test(prompt)) {
        return prompt.slice(0, 200);
      }
    }
  }
  return null;
}

// ─── Object/element replacement extraction ───────────────────────────────────

function extractReplaceIntent(message: string): { from: string; to: string } | null {
  // "change/replace/swap the <element> to/with <new>"
  const swapMatch = message.match(
    /\b(?:change|replace|swap|convert)\s+(?:the\s+)?([\w\s]{2,40}?)\s+(?:to|with|into)\s+([\w\s]{2,60})(?:[.!?]|$)/i
  );
  if (swapMatch) {
    const from = swapMatch[1].trim();
    const to = swapMatch[2].trim();
    if (from.length > 1 && to.length > 1 && !/^background$/i.test(from)) {
      return { from, to };
    }
  }

  // "make it/this <color/description>"  e.g. "make it matte black" / "turn it into a race car"
  const makeMatch = message.match(
    /\b(?:make|turn)\s+(?:it|this)\s+(?:into\s+(?:a\s+|an\s+)?)?(.{3,60})$/i
  );
  if (makeMatch) {
    const to = makeMatch[1].replace(/[.!?]+$/, "").trim();
    if (to.split(/\s+/).length <= 8) {
      return { from: "subject", to };
    }
  }

  return null;
}

// ─── Main transformation detection ───────────────────────────────────────────

type TransformDetect = {
  transformation: CloudinaryTransformation;
  options?: Record<string, unknown>;
};

function detectTransformation(message: string): TransformDetect | null {
  const lower = message.toLowerCase();

  // Simple deterministic transformations
  if (/\bblur\b|\bblurry\b|\bblurred\b/.test(lower)) return { transformation: "blur" };
  if (/\bgrayscale\b|\bgrey\s*scale\b|\bgray\s*scale\b|\bblack and white\b/.test(lower)) {
    return { transformation: "grayscale" };
  }
  if (/\bsharpen\b|\bsharper\b/.test(lower)) return { transformation: "sharpen" };

  // Resize
  if (/\bresize\b|\bscale\b|\bmake (it|this) (smaller|larger)\b/.test(lower)) {
    const size = message.match(/\b(\d{2,5})\s*x\s*(\d{2,5})\b/i);
    const width = message.match(/\b(?:width|wide|to)\s*(\d{2,5})\s*(?:px)?\b/i);
    return {
      transformation: "resize",
      options: size
        ? { width: Number(size[1]), height: Number(size[2]) }
        : width
        ? { width: Number(width[1]) }
        : undefined,
    };
  }

  // Background removal
  if (
    /\b(?:remove|transparent)\s+(?:the\s+)?background\b|\bcut\s+(?:it\s+)?out\b|\bbackground\s+removal\b/.test(
      lower
    )
  ) {
    return { transformation: "remove_background" };
  }

  // Enhance / restore quality
  if (
    /\benhance\b|\brestore\b|\bimprove\s+(?:the\s+)?(?:quality|resolution)\b|\bupscale\b/.test(lower)
  ) {
    return { transformation: "enhance" };
  }

  // Generative object replace (check before background_replace — more specific)
  const replace = extractReplaceIntent(message);
  if (replace) {
    return { transformation: "generative_replace", options: replace };
  }

  // Background replace — environment/scene/poster placement
  const scenePrompt = extractScenePrompt(message);
  if (scenePrompt) {
    return { transformation: "background_replace", options: { prompt: scenePrompt } };
  }

  return null;
}

function cleanUrl(url: string): string {
  return url.replace(/[,.!?;:]+$/, "");
}

export function detectMediaTransformIntent(message: string): MediaTransformIntent | null {
  const detected = detectTransformation(message);
  if (!detected) return null;

  const urlMatch = message.match(CLOUDINARY_IMAGE_URL_RE);
  if (!urlMatch) return null;

  return {
    imageUrl: cleanUrl(urlMatch[0]),
    transformation: detected.transformation,
    ...(detected.options ? { options: detected.options } : {}),
  };
}

// ─── Generation intent ────────────────────────────────────────────────────────

export type GenerateIntent = { prompt: string };

const GENERATE_SIGNALS: RegExp[] = [
  /\b(?:generate|create|make|draw|produce|render|design)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|artwork|visual|sketch|painting)\s+(?:of|showing|depicting|with|about)\s+(.+)/i,
  /\b(?:imagine|visualize)\s+(.+?)\s+(?:as\s+(?:an?\s+)?image|visually)/i,
  /\bwhat\s+(?:would|does)\s+(.+?)\s+look\s+like\b/i,
];

export function detectGenerateIntent(message: string): GenerateIntent | null {
  for (const re of GENERATE_SIGNALS) {
    const match = message.trim().match(re);
    if (match) {
      const prompt = match[1].replace(/[.!?]+$/, "").trim().slice(0, 150);
      if (prompt.length > 3) return { prompt };
    }
  }
  return null;
}
