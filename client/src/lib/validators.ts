import { z } from "zod";

export function formatCPR(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
}

export function isValidCPR(cpr: string): boolean {
  const cprRegex = /^\d{6}-\d{4}$/;
  if (!cprRegex.test(cpr)) return false;
  
  const [birthDate, sequence] = cpr.split('-');
  
  const day = parseInt(birthDate.slice(0, 2), 10);
  const month = parseInt(birthDate.slice(2, 4), 10);
  
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  if (sequence.length !== 4) return false;
  
  return true;
}

export const cprSchema = z.string()
  .regex(/^\d{6}-\d{4}$/, "CPR skal være i formatet XXXXXX-XXXX")
  .refine(isValidCPR, "Ugyldigt CPR-nummer");

export const emailSchema = z.object({
  email: z.string().email("Indtast en gyldig e-mailadresse")
});

export const priorityOptions = [
  { value: 'pris', label: 'Pris (laveste omkostninger)' },
  { value: 'daekning', label: 'Dækning (bedste beskyttelse)' },
  { value: 'service', label: 'Service (kundeservice)' },
  { value: 'balance', label: 'Balance (pris og dækning)' }
] as const;
