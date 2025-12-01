import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import path from 'path';

// Configuration
const MAX_FILES_PER_USER = 50; // Maximum number of documents a user can have
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB (Step 1.4: increased for consistent handling)
const ALLOWED_EXTENSIONS = ['.pdf'];

/**
 * Middleware to validate file uploads and enforce quotas
 */
export async function validateFileUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const userId = req.body.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({ 
        message: "User ID is required for file upload" 
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        message: "No files provided" 
      });
    }

    // Check user's current document count
    const userDocuments = await storage.getUserDocuments(userId);
    
    if (userDocuments.length + files.length > MAX_FILES_PER_USER) {
      return res.status(413).json({ 
        message: `Upload limit exceeded. Maximum ${MAX_FILES_PER_USER} documents allowed per user. You have ${userDocuments.length} documents.` 
      });
    }

    // Validate each file
    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return res.status(413).json({ 
          message: `File "${file.originalname}" exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        });
      }

      // Check file extension
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({ 
          message: `File "${file.originalname}" has invalid extension. Only PDF files are allowed.` 
        });
      }

      // Validate MIME type (defense in depth)
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ 
          message: `File "${file.originalname}" has invalid MIME type. Expected application/pdf, got ${file.mimetype}` 
        });
      }

      // Sanitize filename to prevent path traversal
      const filename = file.originalname;
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ 
          message: `File "${file.originalname}" has invalid characters in filename` 
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('[Upload Validation] Error:', error);
    res.status(500).json({ message: "Upload validation error" });
  }
}

/**
 * Get upload statistics for a user
 */
export async function getUploadStats(userId: string) {
  const documents = await storage.getUserDocuments(userId);
  const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
  
  return {
    documentCount: documents.length,
    maxDocuments: MAX_FILES_PER_USER,
    remaining: MAX_FILES_PER_USER - documents.length,
    totalSize,
    maxFileSize: MAX_FILE_SIZE
  };
}
