import type { Content } from '@google/genai';
import { DocumentRequirement, Scenario, AppSettings } from '../types';
import { db } from './db';

function buildSystemInstruction(defaults: AppSettings['defaults']): string {
  return `
    You are an expert insurance claims scenario generator for a South African insurance company (Naked Insurance).
    Generate and refine realistic third-party motor vehicle accident scenarios.
    
    Context:
    - First Party: ${defaults.firstPartyName} ${defaults.firstPartySurname} (ID: ${defaults.firstPartyId})
    - First Party Vehicle: ${defaults.firstPartyVehicle}
    - Third Party ID Number to use: ${defaults.thirdPartyId}
    
    Rules:
    - The third party must NEVER be fully at fault (there is always a liability claim against our driver).
    - Provide a realistic description of the accident from the first party's perspective.
    - Provide a realistic version of events from the third party's perspective.
    - Invent realistic South African names for the third party and witnesses.
    - Include the third party vehicle make and model.
    - The third party vehicle must be a common, middle-class South African vehicle (for example: Toyota Corolla, VW Polo, Hyundai i20, Ford Fiesta, Renault Kwid, Nissan Almera, Kia Rio, Suzuki Swift).
    - Generate a random 17-character VIN for the third party vehicle (alphanumeric, no I/O/Q).
    - Generate a South African licence plate for the third party vehicle (e.g. CA 123-456 GP or similar provincial format).
    - Generate a realistic South African insurance company name for the third party (e.g. Discovery, Outsurance, King Price, Budget, 1st for Women, Hollard, Auto & General) and a plausible policy number (alphanumeric).
    
    Output Format:
    Always return the scenario as a JSON object matching this schema:
    {
      "firstPartyDescription": "string",
      "witnesses": "string (names and contact info, or 'None')",
      "thirdPartyName": "string",
      "thirdPartySurname": "string",
      "thirdPartyVehicle": "string (make and model only)",
      "thirdPartyVehicleVin": "string (17 characters, alphanumeric, no I/O/Q)",
      "thirdPartyLicencePlate": "string (South African format)",
      "thirdPartyInsuranceCompany": "string",
      "thirdPartyPolicyNumber": "string",
      "thirdPartyVersion": "string"
    }
  `;
}

export class ProxyChat {
  private history: Content[] = [];
  private readonly systemInstruction: string;

  constructor(systemInstruction: string) {
    this.systemInstruction = systemInstruction;
  }

  async sendMessage({ message }: { message: string }): Promise<{ text: string }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: this.history,
        systemInstruction: this.systemInstruction,
      }),
    });

    if (!res.ok) {
      const { error } = await res.json() as { error: string };
      throw new Error(`Chat API error: ${error}`);
    }

    const data = await res.json() as { text: string; history: Content[] };
    this.history = data.history;
    return { text: data.text };
  }
}

export function getScenarioChat(claimNumber: string, defaults: AppSettings['defaults']): ProxyChat {
  void claimNumber;
  return new ProxyChat(buildSystemInstruction(defaults));
}

export async function generateInitialScenario(chat: ProxyChat, claimNumber: string, defaults: AppSettings['defaults'], guidance?: string): Promise<Scenario> {
  const prompt = guidance
    ? `Generate an initial accident scenario for claim number ${claimNumber}. Additional guidance: ${guidance}`
    : `Generate an initial accident scenario for claim number ${claimNumber}.`;

  const response = await chat.sendMessage({ message: prompt });

  const text = response.text;
  if (!text) throw new Error('Failed to generate scenario');

  const data = JSON.parse(text) as Omit<Scenario, 'claimNumber' | 'firstPartyName' | 'firstPartySurname' | 'firstPartyId' | 'firstPartyVehicle' | 'thirdPartyId'>;
  return {
    claimNumber,
    firstPartyName: defaults.firstPartyName,
    firstPartySurname: defaults.firstPartySurname,
    firstPartyId: defaults.firstPartyId,
    firstPartyVehicle: defaults.firstPartyVehicle,
    thirdPartyId: defaults.thirdPartyId,
    ...data,
  };
}

export async function refineScenario(chat: ProxyChat, scenario: Scenario, editPrompt: string): Promise<Scenario> {
  const response = await chat.sendMessage({ message: editPrompt });

  const text = response.text;
  if (!text) throw new Error('Failed to refine scenario');

  const data = JSON.parse(text) as Partial<Scenario>;
  return {
    ...scenario,
    ...data,
  };
}

export async function generateDocumentImage(
  scenario: Scenario,
  requirement: DocumentRequirement,
): Promise<string> {
  const exampleBase64 = await db.get(requirement.id);

  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, requirement, exampleBase64 }),
  });

  if (!res.ok) {
    const { error } = await res.json() as { error: string };
    throw new Error(`Image generation API error: ${error}`);
  }

  const { imageData } = await res.json() as { imageData: string };
  return imageData;
}
