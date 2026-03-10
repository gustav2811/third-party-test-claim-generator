import { GoogleGenAI } from '@google/genai';
import { DocumentRequirement, Scenario, AppSettings } from '../types';
import { db } from './db';

export async function generateScenario(claimNumber: string, defaults: AppSettings['defaults']): Promise<Scenario> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert insurance claims scenario generator for a South African insurance company (Naked Insurance).
    Generate a realistic third-party motor vehicle accident scenario.
    
    Parameters:
    - First Party Claim Number: ${claimNumber}
    - First Party Vehicle: White Fiat 500
    - Third Party ID Number to use: ${defaults.thirdPartyId}
    
    Rules:
    - The third party must NEVER be fully at fault (there is always a liability claim against our driver).
    - Provide a realistic description of the accident from the first party's perspective.
    - Provide a realistic version of events from the third party's perspective.
    - Invent realistic South African names for the third party and witnesses.
    
    Return the scenario as a JSON object matching this schema:
    {
      "firstPartyDescription": "string",
      "witnesses": "string (names and contact info, or 'None')",
      "thirdPartyName": "string",
      "thirdPartySurname": "string",
      "thirdPartyVersion": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    }
  });

  const text = response.text;
  if (!text) throw new Error('Failed to generate scenario');
  
  const data = JSON.parse(text);
  return {
    claimNumber,
    thirdPartyId: defaults.thirdPartyId,
    ...data
  };
}

export async function generateDocumentImage(
  scenario: Scenario,
  requirement: DocumentRequirement
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const exampleBase64 = await db.get(requirement.id);

  const prompt = `
    You are an expert document generator for a South African insurance system.
    Generate a realistic image of a document based on the following scenario and requirements.
    Make it look like a scanned document or a photo of a document.
    All information MUST match the scenario exactly.

    Scenario Context:
    - Claim Number: ${scenario.claimNumber}
    - First Party (Our Insured Driver - White Fiat 500):
      - Description of accident: ${scenario.firstPartyDescription}
      - Witnesses: ${scenario.witnesses}
    - Third Party:
      - Name: ${scenario.thirdPartyName} ${scenario.thirdPartySurname}
      - ID Number: ${scenario.thirdPartyId}
      - Version of events: ${scenario.thirdPartyVersion}
      - Note: The third party must never be fully at fault (there is always a liability claim against our driver).

    Document to Generate:
    - Title: ${requirement.title}
    - Description: ${requirement.description}

    ${exampleBase64 ? 'An example document is provided as an image. Please use it as a structural and stylistic reference, but fill it with the scenario information.' : 'Please generate a realistic looking document from scratch.'}
  `;

  const parts: any[] = [{ text: prompt }];

  if (exampleBase64) {
    const matches = exampleBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.unshift({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image generated');
}
