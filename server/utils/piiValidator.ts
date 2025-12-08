/**
 * PII Validator - Detects and blocks personal information in initial outreach emails
 * 
 * For MVP internal testing, we block:
 * - CPR numbers (Danish personal ID: DDMMYY-XXXX or DDMMYYXXXX)
 * - Phone numbers (Danish format: 8 digits, with or without country code)
 * - Full addresses (street + number patterns)
 * 
 * This protects user privacy in first contact with insurance companies.
 */

export interface PIIValidationResult {
  isValid: boolean;
  blockedItems: {
    type: 'cpr' | 'phone' | 'address';
    match: string;
    redacted: string;
  }[];
  message?: string;
}

// Danish CPR number patterns (DDMMYY-XXXX or DDMMYYXXXX)
const CPR_PATTERNS = [
  /\b(\d{6}[-\s]?\d{4})\b/g,  // DDMMYY-XXXX or DDMMYY XXXX
  /\b(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{2})[-\s]?(\d{4})\b/g,  // Strict date validation
];

// Danish phone number patterns
const PHONE_PATTERNS = [
  /\+45\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g,  // +45 XX XX XX XX
  /\b45\s?\d{8}\b/g,  // 45XXXXXXXX (country code without +)
  /\b\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\b/g,  // XX XX XX XX (8 digits)
  /\b\d{8}\b/g,  // XXXXXXXX (8 digits no spaces)
];

// Danish address patterns (street name + house number)
const ADDRESS_PATTERNS = [
  /\b([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ]?[a-zæøå]+)*(?:vej|gade|alle|stræde|plads|torv|park|vænge|have))\s+(\d+[A-Za-z]?(?:\s*,?\s*\d{1,2}\.?\s*(sal|tv|th|mf|st))?)/gi,
  /\b(\d{4})\s+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ]?[a-zæøå]+)?)\b/g,  // Postal code + city
];

function redactMatch(match: string, type: 'cpr' | 'phone' | 'address'): string {
  switch (type) {
    case 'cpr':
      return '[CPR FJERNET]';
    case 'phone':
      return '[TELEFON FJERNET]';
    case 'address':
      return '[ADRESSE FJERNET]';
    default:
      return '[FJERNET]';
  }
}

function findCPRNumbers(text: string): string[] {
  const matches: string[] = [];
  
  for (const pattern of CPR_PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      // Validate that these look like CPR numbers (first 6 digits are a valid date)
      for (const match of found) {
        const digits = match.replace(/[-\s]/g, '');
        if (digits.length === 10) {
          const day = parseInt(digits.substring(0, 2), 10);
          const month = parseInt(digits.substring(2, 4), 10);
          
          // Basic date validation
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            matches.push(match);
          }
        }
      }
    }
  }
  
  return [...new Set(matches)];
}

function findPhoneNumbers(text: string): string[] {
  const matches: string[] = [];
  
  for (const pattern of PHONE_PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      for (const match of found) {
        // Only include if it looks like a phone number (8 digits for Danish)
        const digits = match.replace(/\D/g, '');
        if (digits.length === 8 || digits.length === 10 || digits.length === 11) {
          matches.push(match);
        }
      }
    }
  }
  
  return [...new Set(matches)];
}

function findAddresses(text: string): string[] {
  const matches: string[] = [];
  
  for (const pattern of ADDRESS_PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }
  
  return [...new Set(matches)];
}

export function validateEmailForPII(emailBody: string): PIIValidationResult {
  const blockedItems: PIIValidationResult['blockedItems'] = [];
  
  // Find CPR numbers
  const cprMatches = findCPRNumbers(emailBody);
  for (const match of cprMatches) {
    blockedItems.push({
      type: 'cpr',
      match,
      redacted: redactMatch(match, 'cpr')
    });
  }
  
  // Find phone numbers
  const phoneMatches = findPhoneNumbers(emailBody);
  for (const match of phoneMatches) {
    blockedItems.push({
      type: 'phone',
      match,
      redacted: redactMatch(match, 'phone')
    });
  }
  
  // Find addresses
  const addressMatches = findAddresses(emailBody);
  for (const match of addressMatches) {
    blockedItems.push({
      type: 'address',
      match,
      redacted: redactMatch(match, 'address')
    });
  }
  
  const isValid = blockedItems.length === 0;
  
  let message: string | undefined;
  if (!isValid) {
    const types = [...new Set(blockedItems.map(i => i.type))];
    const typeLabels = {
      cpr: 'CPR-nummer',
      phone: 'telefonnummer',
      address: 'adresse'
    };
    const labels = types.map(t => typeLabels[t]).join(', ');
    message = `Emailen indeholder personlige oplysninger (${labels}) som ikke må sendes i første henvendelse til forsikringsselskaber.`;
  }
  
  return {
    isValid,
    blockedItems,
    message
  };
}

export function redactPIIFromEmail(emailBody: string): { redacted: string; hadPII: boolean } {
  let redacted = emailBody;
  let hadPII = false;
  
  // Redact CPR numbers
  const cprMatches = findCPRNumbers(emailBody);
  for (const match of cprMatches) {
    redacted = redacted.replace(match, '[CPR FJERNET]');
    hadPII = true;
  }
  
  // Redact phone numbers
  const phoneMatches = findPhoneNumbers(emailBody);
  for (const match of phoneMatches) {
    redacted = redacted.replace(match, '[TELEFON FJERNET]');
    hadPII = true;
  }
  
  // Redact addresses
  const addressMatches = findAddresses(emailBody);
  for (const match of addressMatches) {
    redacted = redacted.replace(match, '[ADRESSE FJERNET]');
    hadPII = true;
  }
  
  return { redacted, hadPII };
}
