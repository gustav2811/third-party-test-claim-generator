export interface Scenario {
  claimNumber: string;
  firstPartyName: string;
  firstPartySurname: string;
  firstPartyId: string;
  firstPartyVehicle: string;
  firstPartyDescription: string;
  witnesses: string;
  thirdPartyName: string;
  thirdPartySurname: string;
  thirdPartyVehicle: string;
  thirdPartyVehicleVin: string;
  thirdPartyLicencePlate: string;
  thirdPartyInsuranceCompany: string;
  thirdPartyPolicyNumber: string;
  thirdPartyId: string;
  thirdPartyVersion: string;
}

export type ClaimType = 'insured' | 'uninsured';

export interface DocumentRequirement {
  id: string;
  title: string;
  description: string;
  documentGuidelines?: string;
}

export interface AppSettings {
  defaults: {
    thirdPartyId: string;
    firstPartyName: string;
    firstPartySurname: string;
    firstPartyId: string;
    firstPartyVehicle: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaults: {
    thirdPartyId: '9001015000087',
    firstPartyName: 'John',
    firstPartySurname: 'Doe',
    firstPartyId: '8501015000081',
    firstPartyVehicle: 'White Fiat 500',
  }
};

export const INSURED_DOCS: DocumentRequirement[] = [
  { id: 'letter_of_demand', title: 'Letter of Demand', description: 'Formal letter demanding payment.' },
  { id: 'assessment_report', title: 'Assessment Report / Quote', description: 'Assessment report for the vehicle or panel beater quote.' },
];

export const UNINSURED_DOCS: DocumentRequirement[] = [
  { id: 'claim_form', title: 'Third Party Claim Form', description: 'Document with all the claim form requirements.' },
  { id: 'quote_1', title: 'Panel Beater Quote 1', description: 'First unique quote.' },
  { id: 'quote_2', title: 'Panel Beater Quote 2', description: 'Second unique quote.' },
  { id: 'quote_3', title: 'Panel Beater Quote 3', description: 'Third unique quote.' },
  { id: 'damage_photo_1', title: 'Damage Photo 1', description: 'Photo of the accident/vehicle.' },
  { id: 'damage_photo_2', title: 'Damage Photo 2', description: 'Photo of the accident/vehicle.' },
  { id: 'damage_photo_3', title: 'Damage Photo 3', description: 'Photo of the accident/vehicle (optional).' },
  { id: 'id_document', title: 'ID Document', description: 'ID document for the involved party.' },
  { id: 'natis_document', title: 'Natis Document', description: 'Natis document for the involved vehicle.' },
  { id: 'no_claims_letter', title: 'No Claims Letter / Affidavit', description: 'Confirming there is no insurance claim.' },
  { id: 'licence_disc', title: 'Licence Disc', description: 'Licence disc on the vehicle screen, showing the VIN.' },
];

export const ALL_DOCS = [...INSURED_DOCS, ...UNINSURED_DOCS];

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
