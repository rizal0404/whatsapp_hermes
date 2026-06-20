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

/**
 * Normalizes Baileys user JID by removing device/stream details.
 * e.g., '628123456789:1@s.whatsapp.net' -> '628123456789@s.whatsapp.net'
 */
export function normalizeUserJid(jid: string): string {
  const clean = jid.split(':')[0];
  if (clean.includes('@')) {
    return clean;
  }
  // Check if it's lid or net
  if (jid.includes('@lid')) {
    return `${clean}@lid`;
  }
  return `${clean}@s.whatsapp.net`;
}

/**
 * Extracts the phone/number part of any WhatsApp JID (e.g., standard, LID, or group ID).
 * e.g., '628123456789:1@s.whatsapp.net' -> '628123456789'
 */
export function extractPhoneFromJid(jid: string): string {
  return jid.split(':')[0].split('@')[0];
}

/**
 * Extracts phone/ID part of LID format.
 */
export function extractPhoneFromLid(lid: string | undefined): string | null {
  if (!lid) return null;
  return extractPhoneFromJid(lid);
}

/**
 * Compares two WhatsApp JIDs or LIDs to check if they represent the same user.
 */
export function isSameUser(jid1: string, jid2: string | null | undefined): boolean {
  if (!jid2) return false;
  return extractPhoneFromJid(jid1) === extractPhoneFromJid(jid2);
}

/**
 * Gets the suffix of a JID (e.g., 's.whatsapp.net', 'g.us', 'lid').
 */
export function getJidSuffix(jid: string): string {
  if (jid.includes('@')) {
    return jid.split('@')[1];
  }
  return '';
}

