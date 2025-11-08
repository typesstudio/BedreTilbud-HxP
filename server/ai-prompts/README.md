# AI Prompts Directory

This directory contains all AI prompts used throughout the BedreTilbud platform. All prompts are stored as Markdown files for easy editing and version control.

## 📁 Directory Structure

```
ai-prompts/
├── comparison/          # Insurance policy comparison prompts
├── emails/             # Email generation prompts
├── ocr/                # PDF extraction prompts
├── health-check/       # Single policy health check prompts
└── utils/              # Prompt loading utilities
```

## 📝 Editing Guidelines

### General Rules
1. **Keep prompts in Danish context** - The platform serves Danish users and insurance companies
2. **Maintain JSON structure** - Many prompts specify exact JSON output formats; preserve these
3. **Test after changes** - Verify AI responses still work correctly
4. **Use clear instructions** - Be specific about what the AI should do

### Prompt Structure
Each prompt file should include:
- **System Context**: Who the AI is (expert, broker, etc.)
- **Task Description**: What the AI needs to do
- **Input Format**: What data the AI receives
- **Output Format**: Expected response structure (especially JSON)
- **Constraints**: Specific rules, calculations, or Danish market context

### Common Variables
Prompts use template variables that get replaced at runtime:
- `${companyName}` - Insurance company name
- `${policyType}` - Type of insurance (indbo, hus, bil, etc.)
- `${userInfo}` - User preferences and information
- `${currentPolicy}` - Current insurance policy data
- `${offerPolicy}` - New offer policy data

### Making Changes

1. **Edit the Markdown file** directly
2. **Save the file** - Changes take effect immediately (prompts are cached)
3. **Test the feature** that uses the prompt
4. **Commit to version control** to track changes

### Fallback Behavior
If a prompt file is missing or unreadable, the system falls back to hardcoded defaults in the service files. This ensures the platform continues working even if files are accidentally deleted.

## 🔍 Finding Which Prompt to Edit

| Feature | Prompt File | Used By |
|---------|-------------|---------|
| Policy comparison | `comparison/policy-comparison.md` | ComparisonService |
| Combined overview | `comparison/combined-overview.md` | PolicyMatchingService |
| Initial inquiry email | `emails/personalized-inquiry.md` | MistralTextService |
| Auto-response to offers | `emails/auto-response.md` | MistralTextService, ComparisonService |
| Missing info follow-up | `emails/missing-info.md` | MistralTextService, ComparisonService |
| AI system persona | `emails/system-prompt.md` | AIResponseService |
| PDF data extraction | `ocr/policy-extraction.md` | MistralOcrService |
| Policy health check | `health-check/analysis.md` | InsuranceCheckService |

## 🛠️ Technical Details

Prompts are loaded using `server/ai-prompts/utils/promptLoader.ts`:
```typescript
import { loadPrompt } from '@/ai-prompts/utils/promptLoader';

const prompt = loadPrompt('comparison/policy-comparison');
```

The loader:
- Reads Markdown files from this directory
- Caches prompts in memory for performance
- Falls back to hardcoded defaults if file is missing
- Provides type-safe prompt names

## ⚠️ Important Notes

- **Never delete this directory** - Services depend on these prompts
- **Test in development first** - Changes affect AI behavior immediately
- **Keep backups** - Use git to track prompt changes over time
- **Danish language** - Most prompts should output Danish text
- **JSON validation** - Ensure JSON structures remain valid after edits
