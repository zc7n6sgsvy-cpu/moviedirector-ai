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