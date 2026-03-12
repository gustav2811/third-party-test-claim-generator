import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

interface Scenario {
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

interface DocumentRequirement {
  id: string;
  title: string;
  description: string;
  documentGuidelines?: string;
}

/** Document IDs that receive full scenario context (first + third party). Excludes damage photos (see DOCS_DAMAGE_PHOTO). */
const DOCS_FULL_SCENARIO = new Set<string>(["claim_form", "letter_of_demand"]);

/** Damage photos get minimal context only: first party vehicle; third party vehicle, licence plate, version of events. */
const DOCS_DAMAGE_PHOTO = new Set<string>([
  "damage_photo_1",
  "damage_photo_2",
  "damage_photo_3",
]);

/** Per-document prompt snippet injected into the generation prompt. Key = requirement.id. */
export const DOCUMENT_PROMPTS: Record<string, string> = {
  claim_form:
    "Include all claim form fields; ensure our driver (first party) and the third party are both clearly identified. Use South African claim form conventions.",
  letter_of_demand:
    "Formal letter from the third party's insurance company demanding liability from our insured driver. South African legal tone.",
  damage_photo_1:
    "Realistic photo of vehicle damage to the THIRD PARTY'S vehicle, given the accident scenario. Close up shot (1m away) of the main damage area.",
  damage_photo_2:
    "Realistic photo of vehicle damage, given the accident scenario. Damage photo should show the entire accident scene based on the scenario.",
  damage_photo_3:
    "Realistic photo of vehicle damage to the THIRD PARTY'S vehicle, given the accident scenario.",
  assessment_report:
    "Insurer's assessment report for the third party's vehicle. Use the third party's vehicle make/model and realistic South African repair costs, based on damage incurred by such an accident.",
  quote_1:
    "Panel beater's quote for the third party's vehicle. Realistic format; include labour and parts, based on damage incurred by such an accident.",
  quote_2:
    "Panel beater's quote, from a different provider. Slightly different line items but same vehicle, based on damage incurred by such an accident.",
  quote_3:
    "Panel beater's quote, from another provider. Same vehicle, different format, based on damage incurred by such an accident.",
  id_document:
    "South African ID document (green book or ID card style). All details must match the third party: name, surname, ID number. Realistic format.",
  natis_document:
    "Natis (vehicle registration) document for the third party's vehicle. Match make, model, and owner details to the scenario.",
  no_claims_letter:
    "Short letter or affidavit stating the third party has no insurance claim / no insurance. Based on the insurer and must mention the accident date.",
  licence_disc:
    "South African licence disc for the third party's vehicle. Show VIN and vehicle details; valid-looking disc for windscreen.",
};

function buildFullScenarioContext(scenario: Scenario): string {
  return `
- Claim Number: ${scenario.claimNumber}
- First Party (Our Insured Driver):
  - Name: ${scenario.firstPartyName} ${scenario.firstPartySurname}
  - ID Number: ${scenario.firstPartyId}
  - Vehicle: ${scenario.firstPartyVehicle}
  - Description of accident: ${scenario.firstPartyDescription}
  - Witnesses: ${scenario.witnesses}
- Third Party:
  - Name: ${scenario.thirdPartyName} ${scenario.thirdPartySurname}
  - ID Number: ${scenario.thirdPartyId}
  - Vehicle: ${scenario.thirdPartyVehicle}
  - Vehicle VIN: ${scenario.thirdPartyVehicleVin}
  - Licence Plate: ${scenario.thirdPartyLicencePlate}
  - Insurance: ${scenario.thirdPartyInsuranceCompany}, Policy: ${scenario.thirdPartyPolicyNumber}
  - Version of events: ${scenario.thirdPartyVersion}
  - Note: The third party must never be fully at fault (there is always a liability claim against our driver).`;
}

/** Minimal context for damage photos only: first party vehicle; third party vehicle, licence plate, version of events. */
function buildDamagePhotoContext(scenario: Scenario): string {
  return `
- First Party vehicle only: ${scenario.firstPartyVehicle}
- Third Party (for damage / scene):
  - Vehicle: ${scenario.thirdPartyVehicle}
  - Licence Plate: ${scenario.thirdPartyLicencePlate}
  - Version of events: ${scenario.thirdPartyVersion}`;
}

function buildThirdPartyOnlyContext(scenario: Scenario): string {
  return `
- Third Party (document owner):
  - Name: ${scenario.thirdPartyName} ${scenario.thirdPartySurname}
  - ID Number: ${scenario.thirdPartyId}
  - Vehicle: ${scenario.thirdPartyVehicle}
  - Vehicle VIN: ${scenario.thirdPartyVehicleVin}
  - Licence Plate: ${scenario.thirdPartyLicencePlate}
  - Insurance: ${scenario.thirdPartyInsuranceCompany}, Policy: ${scenario.thirdPartyPolicyNumber}
  - Version of events: ${scenario.thirdPartyVersion}
All document details must relate only to this third party; do not include first party or claim context unless the document type requires it.`;
}

interface GenerateImageRequestBody {
  scenario: Scenario;
  requirement: DocumentRequirement;
  exampleBase64: string | null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing API key configuration" });
    return;
  }

  const { scenario, requirement, exampleBase64 } =
    req.body as GenerateImageRequestBody;

  if (!scenario || !requirement) {
    res
      .status(400)
      .json({ error: "Missing required fields: scenario, requirement" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const useFullScenario = DOCS_FULL_SCENARIO.has(requirement.id);
    const useDamagePhotoContext = DOCS_DAMAGE_PHOTO.has(requirement.id);
    const scenarioContext = useDamagePhotoContext
      ? buildDamagePhotoContext(scenario)
      : useFullScenario
        ? buildFullScenarioContext(scenario)
        : buildThirdPartyOnlyContext(scenario);

    const documentSpecificPrompt = DOCUMENT_PROMPTS[requirement.id] ?? "";

    let prompt = "";

    if (useDamagePhotoContext) {
      prompt = `
      You are an expert insurance claims photographer.
      Generate a realistic, unedited photograph of a vehicle accident scene or vehicle damage based on the following scenario.
      Do NOT generate a document, paper, or printed photo. Do NOT include any overlaid text, captions, or summaries in the image.
      It must look like a photo taken on an Iphone at the scene.

      Scenario Context:
      ${scenarioContext}

      Photo to Generate:
      - Title: ${requirement.title}
      - Description: ${requirement.description}
      ${documentSpecificPrompt ? `- Photo-specific instructions: ${documentSpecificPrompt}` : ""}

      ${requirement.documentGuidelines ? `Additional User Information:\n      ${requirement.documentGuidelines}` : ""}

      ${
        exampleBase64
          ? "An example photo is provided. Please use it as a structural and stylistic reference, but adjust the vehicles and damage to match the scenario information."
          : "Please generate a realistic looking photograph from scratch."
      }

      IMPORTANT:
      - This must be a pure photograph. No text, no document borders, no handwriting.
      `;
    } else {
      prompt = `
      You are an expert document generator for a South African insurance system.
      Generate a realistic image of a document based on the following scenario and requirements.
      All information MUST match the scenario exactly.

      Scenario Context:
      ${scenarioContext}

      Document to Generate:
      - Title: ${requirement.title}
      - Description: ${requirement.description}
      ${documentSpecificPrompt ? `- Document-specific instructions: ${documentSpecificPrompt}` : ""}

      ${requirement.documentGuidelines ? `Additional User Information:\n      ${requirement.documentGuidelines}` : ""}

      ${
        exampleBase64
          ? "An example document is provided as an image. Please use it as a structural and stylistic reference, but fill it with the scenario information."
          : "Please generate a realistic looking document from scratch."
      }

      IMPORTANT:
      - Documents are for the third party to support a liability claim against our driver where applicable. Use only the context provided above for this document type.
      `;
    }

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];

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
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        res.status(200).json({
          imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        });
        return;
      }
    }

    res.status(500).json({ error: "No image was generated by the model" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
}
