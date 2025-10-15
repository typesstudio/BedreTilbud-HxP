/**
 * Utility to extract only the actual reply text from an email, removing quoted conversation history
 */

export function extractReplyText(emailBody: string): string {
  if (!emailBody) return '';

  const lines = emailBody.split('\n');
  const replyLines: string[] = [];
  
  // Common patterns that indicate start of quoted text
  const quotedPatterns = [
    /^>/,                                                    // Lines starting with >
    /^On .+ wrote:/i,                                        // "On [date] [sender] wrote:"
    /^Den .+ skrev .+:/i,                                    // Danish: "Den [date] skrev [email]:"
    /^Den .+ kl\. .+ skrev .+:/i,                           // Danish: "Den [date] kl. [time] skrev [email]:"
    /^-{3,}/,                                                // Separator lines (---)
    /^_{3,}/,                                                // Underscore separators
    /^From:/i,                                               // Email headers
    /^Sent:/i,
    /^To:/i,
    /^Subject:/i,
    /^Cc:/i,
    /^Fra:/i,                                                // Danish email headers
    /^Sendt:/i,
    /^Til:/i,
    /^Emne:/i,
  ];

  let foundQuotedSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Check if this line starts a quoted section
    const isQuotedLine = quotedPatterns.some(pattern => pattern.test(trimmedLine));
    
    if (isQuotedLine) {
      foundQuotedSection = true;
      break;
    }
    
    // If we haven't found quoted section yet, keep adding lines
    if (!foundQuotedSection) {
      replyLines.push(line);
    }
  }

  // Join the reply lines and clean up
  let replyText = replyLines.join('\n').trim();
  
  // Remove excessive empty lines (more than 2 consecutive)
  replyText = replyText.replace(/\n{3,}/g, '\n\n');
  
  return replyText;
}

/**
 * Clean up email body by removing HTML artifacts and normalizing whitespace
 */
export function cleanEmailBody(body: string): string {
  let cleaned = body;
  
  // Remove zero-width spaces and other invisible characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Normalize multiple spaces
  cleaned = cleaned.replace(/ {2,}/g, ' ');
  
  // Normalize line breaks (handle both \r\n and \n)
  cleaned = cleaned.replace(/\r\n/g, '\n');
  
  return cleaned.trim();
}

/**
 * Full email reply extraction pipeline
 */
export function parseEmailReply(rawEmailBody: string): string {
  const cleaned = cleanEmailBody(rawEmailBody);
  const replyOnly = extractReplyText(cleaned);
  return replyOnly;
}
