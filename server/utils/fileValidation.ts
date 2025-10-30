import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export interface FileChecksumResult {
  sha256: string;
  md5: string;
  size: number;
}

export async function calculateFileChecksum(filePath: string): Promise<FileChecksumResult> {
  const fileBuffer = await readFile(filePath);
  
  const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
  
  return {
    sha256: sha256Hash,
    md5: md5Hash,
    size: fileBuffer.length,
  };
}

export async function verifyFileIntegrity(
  filePath: string,
  expectedChecksum: string,
  algorithm: 'sha256' | 'md5' = 'sha256'
): Promise<boolean> {
  const fileBuffer = await readFile(filePath);
  const actualChecksum = crypto.createHash(algorithm).update(fileBuffer).digest('hex');
  
  return actualChecksum === expectedChecksum;
}

// PDF magic bytes validation (more robust than MIME type)
const PDF_MAGIC_BYTES = [
  Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
];

export async function validatePDFFile(filePath: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const fileBuffer = await readFile(filePath);
    
    // Check minimum size (empty PDFs are suspicious)
    if (fileBuffer.length < 100) {
      return { valid: false, reason: 'File too small to be a valid PDF' };
    }
    
    // Check maximum size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      return { valid: false, reason: 'File exceeds maximum size limit (10MB)' };
    }
    
    // Check magic bytes
    const hasPDFMagic = PDF_MAGIC_BYTES.some(magic => 
      fileBuffer.slice(0, magic.length).equals(magic)
    );
    
    if (!hasPDFMagic) {
      return { valid: false, reason: 'File does not have valid PDF magic bytes' };
    }
    
    // Check for PDF EOF marker
    const eofMarker = Buffer.from('%%EOF');
    const lastBytes = fileBuffer.slice(-100);
    if (!lastBytes.includes(eofMarker)) {
      return { valid: false, reason: 'PDF file appears to be truncated or corrupted' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Malware scanning placeholder (requires external service)
export interface MalwareScanResult {
  clean: boolean;
  threats?: string[];
  scannerUsed: string;
}

export async function scanFileForMalware(filePath: string): Promise<MalwareScanResult> {
  // IMPORTANT: This is a placeholder implementation
  // In production, integrate with ClamAV, VirusTotal, or other malware scanning service
  
  // For now, perform basic heuristic checks
  const fileBuffer = await readFile(filePath);
  
  // Check for suspicious patterns in PDF files
  const suspiciousPatterns = [
    /\/JavaScript/gi,
    /\/JS/gi,
    /\/Launch/gi,
    /\/OpenAction/gi,
    /\/AA/gi, // Auto-action
  ];
  
  const fileContent = fileBuffer.toString('binary');
  const threats: string[] = [];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fileContent)) {
      threats.push(`Suspicious PDF feature detected: ${pattern.source}`);
    }
  }
  
  if (threats.length > 0) {
    return {
      clean: false,
      threats,
      scannerUsed: 'heuristic-basic',
    };
  }
  
  // TODO: Integrate with real malware scanner
  // Example with ClamAV:
  // const { execFile } = require('child_process');
  // const result = await execFile('clamscan', [filePath]);
  
  return {
    clean: true,
    scannerUsed: 'heuristic-basic (WARNING: Not production-ready)',
  };
}
