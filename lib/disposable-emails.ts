// List of disposable email domains to block
export const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'throwaway.email',
  'getnada.com',
  'trashmail.com',
  'fakeinbox.com',
  'yopmail.com',
  'temp-mail.org',
  'maildrop.cc',
  'sharklasers.com',
  'spam4.me',
  'emailondeck.com',
  'dropmail.me',
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}