import { z } from 'zod';

// Email endpoints
export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

export const sendInquiriesSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  companyIds: z.array(z.string().uuid('Invalid company ID')).min(1, 'At least one company required').max(10, 'Too many companies'),
  customMessage: z.string().optional(),
});

// Comparison endpoints
export const addCustomQuestionSchema = z.object({
  category: z.string().min(1, 'Category required'),
  question: z.string().min(1, 'Question required').max(500, 'Question too long'),
});

export const sendQuestionsSchema = z.object({
  questions: z.array(z.object({
    category: z.string(),
    question: z.string(),
    importance: z.enum(['critical', 'important', 'nice-to-have']).optional(),
  })).min(1, 'At least one question required'),
});

// Insurance check endpoints
export const insuranceCheckAnalyzeSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
});

// Household members endpoints
export const createHouseholdMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  name: z.string().min(1, 'Name required').max(100, 'Name too long'),
  relationship: z.string().optional(),
  dateOfBirth: z.string().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
});

export const updateHouseholdMemberSchema = z.object({
  name: z.string().min(1, 'Name required').max(100, 'Name too long').optional(),
  relationship: z.string().optional(),
  dateOfBirth: z.string().optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
});

// Document endpoints
export const reprocessDocumentSchema = z.object({
  documentIds: z.array(z.string().uuid('Invalid document ID')).optional(),
});

// User password endpoints
export const updatePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
});

// Parameter validation
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const threadIdParamSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID format'),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

// Request validation helper
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation failed: ${message}`);
      }
      throw error;
    }
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Invalid URL parameters: ${message}`);
      }
      throw error;
    }
  };
}
