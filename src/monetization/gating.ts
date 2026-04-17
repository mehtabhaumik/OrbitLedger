import type { DocumentPdfStyle } from '../documents';
import type {
  SubscriptionFeatureAccess,
  SubscriptionStatus,
} from './types';
import { resolveSubscriptionFeatureAccess } from './subscription';

export type DocumentFeatureGateState = {
  includeCustomBranding: boolean;
  pdfStyle: DocumentPdfStyle;
  lockedFeatures: SubscriptionFeatureAccess[];
  upgradeTitle: string | null;
  upgradeMessage: string | null;
};

export function resolveDocumentFeatureGates(
  status: SubscriptionStatus
): DocumentFeatureGateState {
  const customBrandingAccess = resolveSubscriptionFeatureAccess(
    status,
    'custom_document_branding'
  );
  const advancedPdfAccess = resolveSubscriptionFeatureAccess(status, 'advanced_pdf_styling');
  const lockedFeatures = [customBrandingAccess, advancedPdfAccess].filter(
    (access) => !access.allowed
  );

  return {
    includeCustomBranding: customBrandingAccess.allowed,
    pdfStyle: advancedPdfAccess.allowed ? 'advanced' : 'basic',
    lockedFeatures,
    upgradeTitle: lockedFeatures.length > 0 ? 'Pro document enhancements' : null,
    upgradeMessage:
      lockedFeatures.length > 0
        ? 'Free statements use a clean basic PDF. Pro adds custom logo and signature branding, advanced PDF styling, and future document enhancements.'
        : null,
  };
}
