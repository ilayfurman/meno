export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'other';

export function detectVideoPlatform(url: string | null | undefined): VideoPlatform | null {
  if (!url) {
    return null;
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (hostname.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  }
  return 'other';
}
