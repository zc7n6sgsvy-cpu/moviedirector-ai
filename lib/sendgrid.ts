import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@moviedirector.ai';

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not set. Email not sent:', options.subject);
    return false;
  }

  try {
    const msg: any = {
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };

    if (options.templateId) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.dynamicTemplateData || {};
      // Remove body when using template
      delete msg.text;
      delete msg.html;
    }

    await sgMail.send(msg);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error?.response?.body || error.message);
    return false;
  }
}

// Specific email helpers for MovieDirector

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetUrl: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: 'Reset your MovieDirector password',
    text: `Hi ${username},\n\nYou requested a password reset for your MovieDirector account.\n\nClick here to reset: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
    html: `
      <p>Hi ${username},</p>
      <p>You requested a password reset for your MovieDirector account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
      <p>— The MovieDirector Team</p>
    `,
  });
}

export async function sendWelcomeEmail(
  email: string,
  username: string
): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://moviedirector-psi.vercel.app';
  return sendEmail({
    to: email,
    subject: 'Welcome to MovieDirector.ai — your free First Cut is ready',
    text: `Welcome ${username}!\n\nYou're a Director on MovieDirector.ai.\n\nNo card required. Start your free First Cut walkthrough:\n• Sitcom pilot cold open\n• Short film beats\n• Brand commercial\n• Launch trailer\n\nYou get 3 free frames + 2 free video clips to create a real sample asset.\n\nThen start a 7-day Creator free trial for full episodes + 500 credits.\n\nStart here: ${base}\n\n— The MovieDirector Team`,
    html: `<p>Welcome <strong>${username}</strong>!</p>
      <p><strong>No card required.</strong> Start your free <em>First Cut</em> walkthrough — sitcom pilot, short film, commercial, or launch trailer.</p>
      <p>You get <strong>3 free frames + 2 free video clips</strong> to create a real sample.</p>
      <p>Then unlock a <strong>7-day Creator free trial</strong> (500 credits) to finish full projects.</p>
      <p><a href="${base}">Create your free First Cut</a></p>`,
  });
}

export async function sendPurchaseReceipt(
  email: string,
  username: string,
  description: string,
  amountLabel: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Receipt: ${description}`,
    text: `Hi ${username},\n\nThanks for your purchase on MovieDirector.\n\n${description}\nAmount: ${amountLabel}\n\nManage billing anytime from the app (Billing → portal).\n`,
    html: `<p>Hi ${username},</p><p>Thanks for your purchase.</p><p><strong>${description}</strong><br/>${amountLabel}</p>`,
  });
}

export async function sendPublishNotification(
  email: string,
  username: string,
  projectTitle: string,
  filmUrl: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Your film "${projectTitle}" is live!`,
    text: `Hi ${username},\n\n"${projectTitle}" has been published to the MovieDirector feed.\n\nWatch & share: ${filmUrl}\n\nKeep creating.`,
    html: `<p>Hi ${username},</p><p>"${projectTitle}" is now live on the feed.</p><p><a href="${filmUrl}">Watch it</a></p>`,
  });
}

export async function sendChannelSubscriptionReceipt(
  email: string,
  username: string,
  channelName: string,
  amount: number
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Receipt: Subscribed to ${channelName}`,
    text: `Hi ${username},\n\nThank you for subscribing to "${channelName}" on MovieDirector.\n\nAmount: $${amount}\n\nYou'll get access to new episodes via email and the platform.`,
    html: `<p>Thank you for subscribing to "${channelName}".</p><p>Receipt: $${amount}</p>`,
  });
}
