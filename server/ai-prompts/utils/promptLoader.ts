import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PromptName = 
  | 'comparison/policy-comparison'
  | 'comparison/system'
  | 'comparison/user'
  | 'emails/personalized-inquiry'
  | 'emails/auto-response'
  | 'emails/missing-info'
  | 'emails/system-prompt'
  | 'ocr/policy-extraction'
  | 'extraction/policy-extractor'
  | 'health-check/analysis';

const promptCache: Map<string, string> = new Map();

const PROMPTS_DIR = path.join(__dirname, '..');

const FALLBACK_PROMPTS: Record<PromptName, string> = {
  'comparison/policy-comparison': `You are an expert Danish insurance advisor analyzing insurance policies. Compare these two policies thoroughly.`,
  'comparison/system': `You are an expert Danish insurance analyst. Compare insurance policies systematically, preserving exact deductible values and providing clear savings analysis in Danish.`,
  'comparison/user': `Generate a comprehensive comparison between the current and offer insurance policies. Return valid JSON matching the ComparisonResult schema.`,
  'emails/personalized-inquiry': `You are a professional insurance broker writing on behalf of clients. Write clear, polite emails in Danish that get results.`,
  'emails/auto-response': `You are writing auto-responses for insurance inquiries. Be professional, polite, and ask intelligent follow-up questions.`,
  'emails/missing-info': `You are a professional insurance broker writing follow-up emails in Danish. Be polite, clear, and professional.`,
  'emails/system-prompt': `You are a helpful AI assistant for BedreTilbud, a Danish insurance comparison platform.`,
  'ocr/policy-extraction': `You are an expert at extracting insurance policy information from documents. Identify ALL distinct insurance policies in the document and extract each one separately.`,
  'extraction/policy-extractor': `You are an expert Danish insurance parsing engine. Extract policies with perfect accuracy from OCR text. Return only valid JSON.`,
  'health-check/analysis': `You are a Danish insurance expert analyzing a user's current insurance policy. Perform a comprehensive health check analysis.`
};

/**
 * Load an AI prompt from a Markdown file
 * @param promptName - The prompt identifier (e.g., 'comparison/policy-comparison')
 * @param useCache - Whether to use cached version (default: true)
 * @returns The prompt text
 */
export function loadPrompt(promptName: PromptName, useCache = true): string {
  if (useCache && promptCache.has(promptName)) {
    return promptCache.get(promptName)!;
  }

  try {
    const filePath = path.join(PROMPTS_DIR, `${promptName}.md`);
    const promptText = fs.readFileSync(filePath, 'utf-8');
    
    promptCache.set(promptName, promptText);
    console.log(`[Prompt Loader] Loaded prompt: ${promptName}`);
    
    return promptText;
  } catch (error) {
    console.warn(`[Prompt Loader] Failed to load ${promptName}, using fallback:`, error instanceof Error ? error.message : 'Unknown error');
    
    const fallback = FALLBACK_PROMPTS[promptName];
    promptCache.set(promptName, fallback);
    
    return fallback;
  }
}

/**
 * Clear the prompt cache (useful for hot-reloading in development)
 */
export function clearPromptCache(): void {
  promptCache.clear();
  console.log('[Prompt Loader] Cache cleared');
}

/**
 * Preload all prompts into cache
 * Call this at server startup for better first-request performance
 */
export function preloadPrompts(): void {
  const allPrompts: PromptName[] = [
    'comparison/policy-comparison',
    'emails/personalized-inquiry',
    'emails/auto-response',
    'emails/missing-info',
    'emails/system-prompt',
    'ocr/policy-extraction',
    'extraction/policy-extractor',
    'health-check/analysis'
  ];

  let loaded = 0;
  let fallbacks = 0;

  for (const promptName of allPrompts) {
    const prompt = loadPrompt(promptName, false);
    if (prompt === FALLBACK_PROMPTS[promptName]) {
      fallbacks++;
    } else {
      loaded++;
    }
  }

  console.log(`[Prompt Loader] Preloaded ${loaded} prompts, ${fallbacks} fallbacks used`);
}

/**
 * Replace template variables in a prompt
 * @param prompt - The prompt template
 * @param variables - Object with variable values
 * @returns Prompt with variables replaced
 */
export function replaceVariables(
  prompt: string,
  variables: Record<string, any>
): string {
  let result = prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    const replacement = typeof value === 'object' 
      ? JSON.stringify(value, null, 2)
      : String(value);
    result = result.replace(regex, replacement);
  }
  
  return result;
}
