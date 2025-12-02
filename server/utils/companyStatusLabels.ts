/**
 * Step 5.2: Company Request/Comparison Status Labels
 * 
 * Maps comparison status to user-friendly Danish labels and descriptions.
 * Used in the offers overview to show per-company status.
 */

export type ComparisonStatusType = 'pending' | 'processing' | 'completed' | 'failed';
export type NotificationStatusType = 'pending' | 'sent' | 'failed' | 'not_required';

export interface StatusLabel {
  label: string;
  description: string;
  variant: 'neutral' | 'warning' | 'success' | 'error';
}

export function getComparisonStatusLabel(
  status: ComparisonStatusType,
  statusReason?: string | null
): StatusLabel {
  switch (status) {
    case 'pending':
      return {
        label: 'Afventer svar',
        description: 'Vi har sendt din forespørgsel til selskabet.',
        variant: 'neutral'
      };
    case 'processing':
      return {
        label: 'Behandler tilbud',
        description: 'Vi har modtaget tilbud og er ved at lave sammenligningen.',
        variant: 'warning'
      };
    case 'completed':
      return {
        label: 'Klar til gennemgang',
        description: 'Dine resultater er klar – klik for at se sammenligningen.',
        variant: 'success'
      };
    case 'failed':
      return getFailedStatusLabel(statusReason);
    default:
      return {
        label: 'Ukendt status',
        description: 'Vi kunne ikke bestemme status for denne forespørgsel.',
        variant: 'neutral'
      };
  }
}

function getFailedStatusLabel(statusReason?: string | null): StatusLabel {
  const baseLabel: StatusLabel = {
    label: 'Der opstod en fejl',
    description: 'Vi kunne ikke færdiggøre denne forespørgsel. Kontakt os, hvis du vil have hjælp.',
    variant: 'error'
  };

  if (!statusReason) return baseLabel;

  switch (statusReason) {
    case 'MISSING_STRUCTURED_POLICY_CURRENT':
      return {
        label: 'Mangler dine policer',
        description: 'Vi mangler data fra dine nuværende forsikringer. Upload venligst dine policer igen.',
        variant: 'error'
      };
    case 'MISSING_STRUCTURED_POLICY_OFFER':
      return {
        label: 'Mangler tilbudsdata',
        description: 'Vi kunne ikke læse tilbuddet fra selskabet. Prøv at uploade det igen.',
        variant: 'error'
      };
    case 'NO_MATCHED_PAIRS':
      return {
        label: 'Ingen matchende policer',
        description: 'Tilbuddet dækker ikke samme forsikringstyper som dine nuværende.',
        variant: 'warning'
      };
    case 'AI_GENERATION_FAILED':
      return {
        label: 'Sammenligning fejlede',
        description: 'Vi kunne ikke generere sammenligningen. Prøv igen senere.',
        variant: 'error'
      };
    default:
      return baseLabel;
  }
}

export function getNotificationStatusLabel(
  notificationStatus: NotificationStatusType,
  notificationError?: string | null
): StatusLabel | null {
  switch (notificationStatus) {
    case 'sent':
      return null; // No need to show anything when notification was sent successfully
    case 'failed':
      return {
        label: 'Email ikke sendt',
        description: notificationError 
          ? `Vi kunne ikke sende dig en email: ${notificationError}` 
          : 'Vi kunne ikke sende dig en email om, at din sammenligning er klar.',
        variant: 'warning'
      };
    case 'pending':
    case 'not_required':
    default:
      return null; // No need to show anything for these states
  }
}

export function getOverallStatusLabel(
  comparisonStatus: ComparisonStatusType,
  statusReason?: string | null,
  notificationStatus?: NotificationStatusType | null,
  notificationError?: string | null
): {
  comparison: StatusLabel;
  notification: StatusLabel | null;
} {
  return {
    comparison: getComparisonStatusLabel(comparisonStatus, statusReason),
    notification: notificationStatus 
      ? getNotificationStatusLabel(notificationStatus as NotificationStatusType, notificationError)
      : null
  };
}
