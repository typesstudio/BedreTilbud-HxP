import { z } from 'zod';

export type ModelId = 
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gpt-4o-reasoning'
  | 'mistral-large-latest'
  | 'mistral-ocr-latest';

export type PipelineStep = 
  | 'policySegmentation'
  | 'structuredExtraction'
  | 'healthCheck'
  | 'ocr';

export interface ModelMetadata {
  id: ModelId;
  provider: 'openai' | 'mistral';
  displayName: string;
  supportsReasoning: boolean;
  supportsStructuredOutput: boolean;
  pricePerMillionInputTokens: number;
  pricePerMillionOutputTokens: number;
  maxTokens: number;
  rateLimitPerMinute: number;
  description: string;
}

export interface ModelProfile {
  modelId: ModelId;
  fallbackChain?: ModelId[];
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface PipelineConfig {
  policySegmentation: ModelProfile;
  structuredExtraction: ModelProfile;
  healthCheck: ModelProfile;
  ocr: ModelProfile;
}

export interface StepExecutionContext {
  step: PipelineStep;
  documentId: string;
  modelId: ModelId;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface AiInvocationLog {
  step: PipelineStep;
  documentId: string;
  modelId: ModelId;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  confidenceScore?: number;
  errorMessage?: string;
  timestamp: Date;
}

const MODEL_REGISTRY: Record<ModelId, ModelMetadata> = {
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    supportsReasoning: false,
    supportsStructuredOutput: true,
    pricePerMillionInputTokens: 0.15,
    pricePerMillionOutputTokens: 0.60,
    maxTokens: 16384,
    rateLimitPerMinute: 500,
    description: 'Fast, cost-efficient model for simple tasks'
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    supportsReasoning: false,
    supportsStructuredOutput: true,
    pricePerMillionInputTokens: 5.00,
    pricePerMillionOutputTokens: 15.00,
    maxTokens: 16384,
    rateLimitPerMinute: 500,
    description: 'High-quality model with better understanding'
  },
  'gpt-4o-reasoning': {
    id: 'gpt-4o-reasoning',
    provider: 'openai',
    displayName: 'GPT-4o with Reasoning',
    supportsReasoning: true,
    supportsStructuredOutput: false,
    pricePerMillionInputTokens: 5.00,
    pricePerMillionOutputTokens: 15.00,
    maxTokens: 16384,
    rateLimitPerMinute: 100,
    description: 'Best quality with extended reasoning for complex tasks'
  },
  'mistral-large-latest': {
    id: 'mistral-large-latest',
    provider: 'mistral',
    displayName: 'Mistral Large',
    supportsReasoning: false,
    supportsStructuredOutput: true,
    pricePerMillionInputTokens: 2.00,
    pricePerMillionOutputTokens: 6.00,
    maxTokens: 128000,
    rateLimitPerMinute: 200,
    description: 'Alternative high-quality model'
  },
  'mistral-ocr-latest': {
    id: 'mistral-ocr-latest',
    provider: 'mistral',
    displayName: 'Mistral OCR',
    supportsReasoning: false,
    supportsStructuredOutput: false,
    pricePerMillionInputTokens: 0.02,
    pricePerMillionOutputTokens: 0.10,
    maxTokens: 128000,
    rateLimitPerMinute: 100,
    description: 'Specialized OCR model for document extraction'
  }
};

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  ocr: {
    modelId: 'mistral-ocr-latest',
    maxTokens: 128000
  },
  policySegmentation: {
    modelId: 'gpt-4o-reasoning',
    fallbackChain: ['gpt-4o', 'gpt-4o-mini'],
    temperature: 0.1,
    maxTokens: 16384,
    reasoningEffort: 'medium'
  },
  structuredExtraction: {
    modelId: 'gpt-4o',
    fallbackChain: ['gpt-4o-mini'],
    temperature: 0,
    maxTokens: 16384
  },
  healthCheck: {
    modelId: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4096
  }
};

const configSchema = z.object({
  ocr: z.object({
    modelId: z.enum(['mistral-ocr-latest'] as const),
    maxTokens: z.number().optional()
  }).optional(),
  policySegmentation: z.object({
    modelId: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4o-reasoning', 'mistral-large-latest'] as const),
    fallbackChain: z.array(z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4o-reasoning', 'mistral-large-latest'] as const)).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional()
  }).optional(),
  structuredExtraction: z.object({
    modelId: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4o-reasoning', 'mistral-large-latest'] as const),
    fallbackChain: z.array(z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4o-reasoning', 'mistral-large-latest'] as const)).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().optional()
  }).optional(),
  healthCheck: z.object({
    modelId: z.enum(['gpt-4o-mini', 'gpt-4o', 'mistral-large-latest'] as const),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().optional()
  }).optional()
});

export function resolveStepConfig(envOverrides?: string): PipelineConfig {
  let config = { ...DEFAULT_PIPELINE_CONFIG };
  
  if (envOverrides) {
    try {
      const parsed = JSON.parse(envOverrides);
      const validated = configSchema.parse(parsed);
      config = {
        ...config,
        ...validated
      };
    } catch (error) {
      console.error('[AI Models] Failed to parse config overrides, using defaults:', error);
    }
  }
  
  return config;
}

export function getModelMetadata(modelId: ModelId): ModelMetadata {
  const metadata = MODEL_REGISTRY[modelId];
  if (!metadata) {
    throw new Error(`Unknown model ID: ${modelId}`);
  }
  return metadata;
}

export function calculateCost(modelId: ModelId, inputTokens: number, outputTokens: number): number {
  const metadata = getModelMetadata(modelId);
  const inputCost = (inputTokens / 1_000_000) * metadata.pricePerMillionInputTokens;
  const outputCost = (outputTokens / 1_000_000) * metadata.pricePerMillionOutputTokens;
  return inputCost + outputCost;
}

export function logAiInvocation(log: AiInvocationLog): void {
  const cost = log.costUsd;
  const confidence = log.confidenceScore ? ` | Confidence: ${(log.confidenceScore * 100).toFixed(1)}%` : '';
  
  console.log(
    `[AI Invocation] ${log.step} | ${log.modelId} | ` +
    `${log.inputTokens + log.outputTokens} tokens | ` +
    `$${cost.toFixed(4)} | ${log.latencyMs}ms${confidence} | ` +
    `${log.success ? '✓' : '✗ ' + log.errorMessage}`
  );
}

export function getPipelineConfig(): PipelineConfig {
  const envConfig = process.env.AI_PIPELINE_CONFIG;
  return resolveStepConfig(envConfig);
}

export function getStepProfile(step: PipelineStep, config?: PipelineConfig): ModelProfile {
  const pipelineConfig = config || getPipelineConfig();
  return pipelineConfig[step];
}

export function getAllModels(): ModelMetadata[] {
  return Object.values(MODEL_REGISTRY);
}

export function getModelsByProvider(provider: 'openai' | 'mistral'): ModelMetadata[] {
  return getAllModels().filter(m => m.provider === provider);
}
