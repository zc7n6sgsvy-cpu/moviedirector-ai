const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://moviedirector-psi.vercel.app';

export function filmShareUrl(feedItemId: string) {
  return `${APP_URL}/?film=${feedItemId}`;
}

export function openPlatformShare(
  platform: string,
  opts: { title: string; caption: string; url: string }
) {
  const { title, caption, url } = opts;
  const text = `${caption}\n\n${url}`;

  switch (platform) {
    case 'x':
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
        '_blank',
        'noopener,noreferrer'
      );
      break;
    case 'linkedin':
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        '_blank',
        'noopener,noreferrer'
      );
      break;
    case 'facebook':
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        '_blank',
        'noopener,noreferrer'
      );
      break;
    default:
      if (navigator.share) {
        navigator.share({ title, text: caption, url }).catch(() => {
          navigator.clipboard.writeText(text);
        });
      } else {
        navigator.clipboard.writeText(text);
      }
  }
}

export async function copySharePack(caption: string, url: string) {
  const pack = `${caption}\n\nWatch: ${url}\n\n#AIFilm #MovieDirector #PersonalBrand`;
  await navigator.clipboard.writeText(pack);
  return pack;
}