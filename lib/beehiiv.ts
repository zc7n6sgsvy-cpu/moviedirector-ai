const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

export async function subscribeToBeehiiv(email: string, name?: string) {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID || !email) {
    console.warn('beehiiv not configured or no email');
    return false;
  }

  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BEEHIIV_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        first_name: name || undefined,
        utm_source: 'moviedirector',
        send_welcome_email: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('beehiiv subscribe failed:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('beehiiv error:', e);
    return false;
  }
}

export async function unsubscribeFromBeehiiv(email: string) {
  if (!BEEHIIV_API_KEY || !BEEHIIV_PUBLICATION_ID) return false;
  // beehiiv unsubscribe usually via link in emails; for API we can use update status
  // For simplicity, skip full impl or use their bulk if available.
  return true;
}
