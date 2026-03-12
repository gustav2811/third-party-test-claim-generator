import type { Content } from "@google/genai";
import type { DocumentRequirement, Scenario, AppSettings } from "../types";
import { db } from "./db";

/** VIN allowed chars: [^\\Wioq] = 0-9 and A–Z except I,O,Q (validator lowercases before test) */
const VIN_CHARS = "0123456789abcdefghjklmnprstuvwxyz";

function generateRandomVIN(): string {
  let vin = "";
  for (let i = 0; i < 17; i++) {
    vin += VIN_CHARS[Math.floor(Math.random() * VIN_CHARS.length)];
  }
  return vin;
}

function buildSystemInstruction(defaults: AppSettings["defaults"]): string {
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
      "thirdPartyVehicleColour": "string (common vehicle colour, e.g. Silver, White, Black, Red)",
      "thirdPartyLicencePlate": "string (South African format)",
      "thirdPartyInsuranceCompany": "string",
      "thirdPartyPolicyNumber": "string",
      "thirdPartyVersion": "string",
      "accidentReportNumber": "string (police report number - may reference nearest police station)",
      "accidentDate": "string (e.g. 2024-01-15)",
      "accidentTime": "string (e.g. 14:30)",
      "accidentPlace": "string (address or place of accident)"
    }
  `;
}

export class ProxyChat {
  private history: Content[] = [];
  private readonly systemInstruction: string;

  constructor(systemInstruction: string) {
    this.systemInstruction = systemInstruction;
  }

  async sendMessage({
    message,
  }: {
    message: string;
  }): Promise<{ text: string }> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: this.history,
        systemInstruction: this.systemInstruction,
      }),
    });

    if (!res.ok) {
      const { error } = (await res.json()) as { error: string };
      throw new Error(`Chat API error: ${error}`);
    }

    const data = (await res.json()) as { text: string; history: Content[] };
    this.history = data.history;
    return { text: data.text };
  }
}

export function getScenarioChat(
  claimNumber: string,
  defaults: AppSettings["defaults"],
): ProxyChat {
  void claimNumber;
  return new ProxyChat(buildSystemInstruction(defaults));
}

export async function generateInitialScenario(
  chat: ProxyChat,
  claimNumber: string,
  defaults: AppSettings["defaults"],
  guidance?: string,
): Promise<Scenario> {
  const prompt = guidance
    ? `Generate an initial accident scenario for claim number ${claimNumber}. Additional guidance: ${guidance}`
    : `Generate an initial accident scenario for claim number ${claimNumber}.`;

  const response = await chat.sendMessage({ message: prompt });

  const text = response.text;
  if (!text) throw new Error("Failed to generate scenario");

  const data = JSON.parse(text) as Omit<
    Scenario,
    | "claimNumber"
    | "firstPartyName"
    | "firstPartySurname"
    | "firstPartyId"
    | "firstPartyVehicle"
    | "thirdPartyId"
    | "thirdPartyVehicleVin"
  > & Partial<Pick<Scenario, "accidentReportNumber" | "accidentDate" | "accidentTime" | "accidentPlace">>;
  return {
    claimNumber,
    firstPartyName: defaults.firstPartyName,
    firstPartySurname: defaults.firstPartySurname,
    firstPartyId: defaults.firstPartyId,
    firstPartyVehicle: defaults.firstPartyVehicle,
    thirdPartyId: defaults.thirdPartyId,
    thirdPartyVehicleVin: generateRandomVIN(),
    ...data,
  };
}

export async function refineScenario(
  chat: ProxyChat,
  scenario: Scenario,
  editPrompt: string,
): Promise<Scenario> {
  const response = await chat.sendMessage({ message: editPrompt });

  const text = response.text;
  if (!text) throw new Error("Failed to refine scenario");

  const data = JSON.parse(text) as Partial<Scenario>;
  const merged: Scenario = {
    ...scenario,
    ...data,
  };
  if (data.thirdPartyVehicleVin !== undefined) {
    merged.thirdPartyVehicleVin = generateRandomVIN();
  }
  return merged;
}

/** VIN/engine chars shared with the API: deterministic engine number derivation */
function deriveEngineNumber(vin: string): string {
  const seed = vin.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `ENG${seed.slice(-8).padStart(8, "0")}`;
}

function fillClaimTemplate(
  html: string,
  data: Record<string, string>,
): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

export async function generateClaimFormPdf(
  scenario: Scenario,
  settings: AppSettings,
): Promise<Blob> {
  const defaults = settings.defaults;

  const thirdPartyEmail = `${(scenario.thirdPartyName ?? "").toLowerCase().replace(/\s+/g, "")}.${(scenario.thirdPartySurname ?? "").toLowerCase().replace(/\s+/g, "")}@yahoo.com`;
  const thirdPartyContactPerson = `${scenario.thirdPartyName ?? ""} ${scenario.thirdPartySurname ?? ""}`.trim();

  const data: Record<string, string> = {
    claimNumber: scenario.claimNumber ?? "",
    accidentReportNumber: scenario.accidentReportNumber ?? "",
    accidentDate: scenario.accidentDate ?? "",
    accidentTime: scenario.accidentTime ?? "",
    accidentPlace: scenario.accidentPlace ?? "",
    firstPartyName: scenario.firstPartyName ?? "",
    firstPartySurname: scenario.firstPartySurname ?? "",
    firstPartyId: scenario.firstPartyId ?? "",
    firstPartyVehicle: scenario.firstPartyVehicle ?? "",
    firstPartyVehicleColour: defaults.firstPartyVehicleColour ?? "White",
    firstPartyVehicleRegistration: defaults.firstPartyVehicleRegistration ?? "",
    witnesses: scenario.witnesses ?? "",
    thirdPartyName: scenario.thirdPartyName ?? "",
    thirdPartySurname: scenario.thirdPartySurname ?? "",
    thirdPartyId: scenario.thirdPartyId ?? "",
    thirdPartyEmail,
    thirdPartyContactPerson,
    thirdPartyContactNumber: "082 800 1234",
    thirdPartyInsured: "Y",
    thirdPartyVehicle: scenario.thirdPartyVehicle ?? "",
    thirdPartyVehicleColour: scenario.thirdPartyVehicleColour ?? "",
    thirdPartyVehicleVin: scenario.thirdPartyVehicleVin ?? "",
    thirdPartyEngineNumber: deriveEngineNumber(scenario.thirdPartyVehicleVin ?? scenario.claimNumber),
    thirdPartyLicencePlate: scenario.thirdPartyLicencePlate ?? "",
    thirdPartyInsuranceCompany: scenario.thirdPartyInsuranceCompany ?? "",
    thirdPartyPolicyNumber: scenario.thirdPartyPolicyNumber ?? "",
    thirdPartyVersion: scenario.thirdPartyVersion ?? "",
    heroLogo: "",
  };

  const { default: rawTemplate } = await import(
    "../../templates/claim-form-template.html?raw"
  );
  const filledHtml = fillClaimTemplate(rawTemplate as string, data);

  const html2pdf = (await import("html2pdf.js")).default as (
    element?: unknown
  ) => {
    from: (el: HTMLElement) => {
      set: (opts: Record<string, unknown>) => {
        outputPdf: (type: string) => Promise<Blob>;
      };
    };
  };

  const container = document.createElement("div");
  container.innerHTML = filledHtml;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  document.body.appendChild(container);

  try {
    const blob = await html2pdf()
      .from(container.firstElementChild as HTMLElement)
      .set({
        margin: 0,
        filename: `third-party-claim-form-${scenario.claimNumber ?? "claim"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .outputPdf("blob");

    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

export async function generateDocumentImage(
  scenario: Scenario,
  requirement: DocumentRequirement,
): Promise<string> {
  const exampleBase64 = await db.get(requirement.id);

  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, requirement, exampleBase64 }),
  });

  if (!res.ok) {
    const { error } = (await res.json()) as { error: string };
    throw new Error(`Image generation API error: ${error}`);
  }

  const { imageData } = (await res.json()) as { imageData: string };
  return imageData;
}
