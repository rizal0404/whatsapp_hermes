import { ValidationError } from '../common/errors';

/**
 * Normalizes user input phone numbers or group IDs to valid WhatsApp JIDs.
 * @param to recipient input string
 * @returns normalized JID string
 */
export function normalizeJid(to: string): string {
  const cleanTo = to.trim();

  if (!cleanTo) {
    throw new ValidationError('Recipient address cannot be empty');
  }

  // Already a valid JID format
  if (cleanTo.endsWith('@s.whatsapp.net') || cleanTo.endsWith('@g.us')) {
    return cleanTo;
  }

  // If it's a group JID (contains '-' and ends with @g.us is covered above, but let's check format)
  if (cleanTo.includes('-') || cleanTo.length > 15) {
    if (cleanTo.endsWith('@g.us')) {
      return cleanTo;
    }
    // If it's just a long digit string (like 120363071378877140) we check and append @g.us
    if (/^\d+$/.test(cleanTo) || cleanTo.includes('-')) {
      return `${cleanTo}@g.us`;
    }
  }

  // Otherwise, it must be a phone number
  let phone = cleanTo.replace(/\D/g, ''); // strip all non-digits

  if (phone.startsWith('0')) {
    phone = '62' + phone.substring(1);
  }

  if (!phone) {
    throw new ValidationError(`Invalid recipient format: '${to}'`);
  }

  return `${phone}@s.whatsapp.net`;
}

/**
 * Helper to determine recipient type
 */
export function getRecipientType(jid: string): 'phone' | 'group' {
  if (jid.endsWith('@g.us')) {
    return 'group';
  }
  return 'phone';
}
