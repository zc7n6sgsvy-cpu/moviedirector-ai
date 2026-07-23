export type VideoMode = 'text-to-video' | 'image-to-video' | 'reference-to-video' | 'extend-video';

export type GenerateVideoInput = {
  prompt: string;
  mode?: VideoMode;
  imageUrl?: string;
  videoUrl?: string;
  referenceImageUrls?: string[];
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  model?: string;
};

type VideoJobResult = {
  url: string;
  duration?: number;
  model?: string;
};

const DEFAULT_MODEL = process.env.XAI_VIDEO_MODEL || 'grok-imagine-video';

function getApiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY is not configured');
  return key;
}

async function startVideoJob(body: Record<string, unknown>) {
  const response = await fetch('https://api.x.ai/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'Video generation failed to start');
  }
  return data.request_id as string;
}

async function pollVideoJob(requestId: string, timeoutMs = 10 * 60 * 1000): Promise<VideoJobResult> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    const data = await response.json();

    if (data.status === 'done') {
      return {
        url: data.video.url,
        duration: data.video.duration,
        model: data.model,
      };
    }
    if (data.status === 'failed') {
      throw new Error(data.error?.message || 'Video generation failed');
    }
    if (data.status === 'expired') {
      throw new Error('Video generation request expired');
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Video generation timed out');
}

export async function generateVideo(input: GenerateVideoInput): Promise<VideoJobResult> {
  const mode = input.mode || (input.videoUrl ? 'extend-video' : input.imageUrl ? 'image-to-video' : 'text-to-video');
  const duration = Math.min(15, Math.max(1, input.duration || 8));
  const model = input.model || DEFAULT_MODEL;

  if (mode === 'extend-video') {
    if (!input.videoUrl) throw new Error('videoUrl required for extend-video');
    const response = await fetch('https://api.x.ai/v1/videos/extensions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        video: { url: input.videoUrl },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Video extension failed to start');
    return pollVideoJob(data.request_id);
  }

  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    duration,
    aspect_ratio: input.aspectRatio || '16:9',
    resolution: input.resolution || '720p',
  };

  if (mode === 'image-to-video' && input.imageUrl) {
    body.image = { url: input.imageUrl };
  }

  if (mode === 'reference-to-video' && input.referenceImageUrls?.length) {
    body.reference_images = input.referenceImageUrls.map((url) => ({ url }));
  }

  const requestId = await startVideoJob(body);
  return pollVideoJob(requestId);
}

export async function generateImage(prompt: string, aspectRatio = '16:9'): Promise<{ url: string }> {
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_IMAGE_MODEL || 'grok-imagine-image',
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'Image generation failed');
  }

  const url = data.data?.[0]?.url || data.url;
  if (!url) throw new Error('No image URL returned from xAI');
  return { url };
}

/**
 * Image edit / multi-image edit — critical for continuity bridges.
 * Uses neighbor frames so the model cannot invent an unrelated scene.
 * @see https://docs.x.ai/developers/model-capabilities/images/editing
 */
export async function editImage(
  prompt: string,
  imageUrls: string[],
  aspectRatio = '16:9'
): Promise<{ url: string }> {
  const urls = imageUrls.filter(Boolean).slice(0, 3);
  if (!urls.length) {
    return generateImage(prompt, aspectRatio);
  }

  const model = process.env.XAI_IMAGE_EDIT_MODEL || process.env.XAI_IMAGE_MODEL || 'grok-imagine-image';

  // Single image: { url, type }. Multi: array of same shape (xAI multi-image edit).
  const imagePayload =
    urls.length === 1
      ? { url: urls[0], type: 'image_url' as const }
      : urls.map((url) => ({ url, type: 'image_url' as const }));

  const response = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      image: imagePayload,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    // Fallback: try generations if edits endpoint rejects shape
    const msg = data?.error?.message || data?.error || 'Image edit failed';
    console.error('editImage failed, falling back to text gen:', msg);
    throw new Error(typeof msg === 'string' ? msg : 'Image edit failed');
  }

  const url = data.data?.[0]?.url || data.url;
  if (!url) throw new Error('No image URL returned from xAI edit');
  return { url };
}

/** Built-in xAI TTS voice ids (original performers — not celebrity clones). */
export const XAI_TTS_VOICES = [
  { id: 'ara', label: 'Ara', hint: 'Warm, clear' },
  { id: 'eve', label: 'Eve', hint: 'Bright, expressive' },
  { id: 'leo', label: 'Leo', hint: 'Grounded, male-leaning' },
  { id: 'rex', label: 'Rex', hint: 'Deep, steady' },
  { id: 'sal', label: 'Sal', hint: 'Soft, intimate' },
] as const;

export type GenerateSpeechInput = {
  text: string;
  voice?: string;
  /** Optional performance direction prepended as speech tags when supported */
  styleHint?: string;
};

/**
 * xAI Text-to-Speech → audio bytes (mp3).
 * @see https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
 */
export async function generateSpeech(input: GenerateSpeechInput): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const text = input.text.trim();
  if (!text) throw new Error('text required for speech');

  const voice = input.voice || 'ara';
  const body: Record<string, unknown> = {
    text: input.styleHint ? `${input.styleHint} ${text}` : text,
    voice,
    format: 'mp3',
  };

  const response = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'Speech generation failed';
    try {
      const err = await response.json();
      message = err?.error?.message || err?.error || message;
    } catch {
      message = (await response.text()) || message;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}