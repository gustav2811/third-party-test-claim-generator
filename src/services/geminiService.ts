import type { Content } from "@google/genai";
import { truncateAccidentReportNumber } from "../accidentReportNumber";
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

/** Returns yesterday's date (YYYY-MM-DD) for use as default loss/accident date. */
function getReferenceYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildSystemInstruction(defaults: AppSettings["defaults"]): string {
  const referenceYesterday = getReferenceYesterday();
  return `
    You are an expert insurance claims scenario generator for a South African insurance company (Naked Insurance).
    Generate and refine realistic third-party motor vehicle accident scenarios.
    
    Loss date (critical): Every scenario MUST include a loss date (the date of the accident). Use this as reference: today's date is one day after ${referenceYesterday}. The loss date must be on or before ${referenceYesterday} (at least one day in the past so claims are easier to process). Always set "accidentDate" to a concrete date in the past, e.g. ${referenceYesterday} or earlier.
    
    Context:
    - First Party: ${defaults.firstPartyName} ${defaults.firstPartySurname} (ID: ${defaults.firstPartyId})
    - First Party Vehicle: ${defaults.firstPartyVehicle}
    - Third Party: ${defaults.thirdPartyName} ${defaults.thirdPartySurname} (ID: ${defaults.thirdPartyId}, Contact: ${defaults.thirdPartyContactNumber}, Email: ${defaults.thirdPartyEmail})
    - Third Party Vehicle: ${defaults.thirdPartyVehicle}, Plate: ${defaults.thirdPartyLicencePlate}, VIN: ${defaults.thirdPartyVehicleVin}, Engine: ${defaults.thirdPartyEngineNumber}
    - Third Party Insurer: ${defaults.thirdPartyInsuranceCompany}
    
    Rules:
    - The third party must NEVER be fully at fault (there is always a liability claim against our driver).
    - Provide a realistic description of the accident from the first party's perspective.
    - Provide a realistic version of events from the third party's perspective.
    - Invent realistic South African names for the third party and witnesses.
    - Include the third party vehicle make and model.
    - The third party vehicle must be a common, middle-class South African vehicle (for example: Toyota Corolla, VW Polo, Hyundai i20, Ford Fiesta, Renault Kwid, Nissan Almera, Kia Rio, Suzuki Swift).
    - Generate a South African licence plate for the third party vehicle (e.g. CA 123-456 GP or similar provincial format).
    - Generate a realistic South African insurance company name for the third party (e.g. Discovery, Outsurance, King Price, Budget, 1st for Women, Hollard, Auto & General) and a plausible policy number (alphanumeric).
    - Police / accident report number ("accidentReportNumber"): must be at most 20 characters (count every character); use a short reference or station code plus digits — never exceed 20 characters.
    
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
      "accidentReportNumber": "string (police report number; MAX 20 characters; may reference nearest police station)",
      "accidentDate": "string (loss date; MUST be on or before ${referenceYesterday}, e.g. ${referenceYesterday} or 2024-01-15)",
      "accidentTime": "string (e.g. 14:30)",
      "accidentPlace": "string (address or place of accident)",
      "assessmentAmount": number (realistic repair cost in ZAR for the third party vehicle damage, e.g. 25000 to 85000 for typical panel/repair work; single number, no decimals or use 2 decimals)
    }
    Costing rule: The final costing report (FRC) will be computed as 10% above assessmentAmount. Use assessmentAmount for consistent costing across all documents.
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
    ? `Generate an initial accident scenario for claim number ${claimNumber}. Additional guidance: ${guidance}, which overrides information defaulted in the system instruction.`
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
    | "finalCostingReportAmount"
  > &
    Partial<
      Pick<
        Scenario,
        | "accidentReportNumber"
        | "accidentDate"
        | "accidentTime"
        | "accidentPlace"
        | "assessmentAmount"
        | "quote1Amount"
        | "quote2Amount"
        | "quote3Amount"
      >
    >;

  const assessmentAmount =
    typeof data.assessmentAmount === "number"
      ? data.assessmentAmount
      : undefined;
  const finalCostingReportAmount =
    assessmentAmount != null
      ? Math.round(assessmentAmount * 1.1 * 100) / 100
      : undefined;
  const baseQuote = assessmentAmount ?? 0;
  const accidentReportNumber = truncateAccidentReportNumber(
    data.accidentReportNumber,
  );

  return {
    ...data,
    accidentReportNumber,
    claimNumber,
    firstPartyName: defaults.firstPartyName,
    firstPartySurname: defaults.firstPartySurname,
    firstPartyId: defaults.firstPartyId,
    firstPartyVehicle: defaults.firstPartyVehicle,
    thirdPartyId: defaults.thirdPartyId,
    thirdPartyName: defaults.thirdPartyName,
    thirdPartySurname: defaults.thirdPartySurname,
    thirdPartyVehicle: defaults.thirdPartyVehicle,
    thirdPartyLicencePlate: defaults.thirdPartyLicencePlate,
    thirdPartyVehicleVin: defaults.thirdPartyVehicleVin || generateRandomVIN(),
    thirdPartyInsuranceCompany: defaults.thirdPartyInsuranceCompany,
    thirdPartyPolicyNumber: data.thirdPartyPolicyNumber ?? "",
    thirdPartyVersion: data.thirdPartyVersion ?? "",
    assessmentAmount,
    finalCostingReportAmount,
    quote1Amount:
      typeof data.quote1Amount === "number"
        ? data.quote1Amount
        : baseQuote || undefined,
    quote2Amount:
      typeof data.quote2Amount === "number"
        ? data.quote2Amount
        : baseQuote || undefined,
    quote3Amount:
      typeof data.quote3Amount === "number"
        ? data.quote3Amount
        : baseQuote || undefined,
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
  merged.accidentReportNumber = truncateAccidentReportNumber(
    merged.accidentReportNumber,
  );
  if (data.thirdPartyVehicleVin !== undefined) {
    merged.thirdPartyVehicleVin = generateRandomVIN();
  }
  const assessment = merged.assessmentAmount ?? scenario.assessmentAmount;
  if (typeof assessment === "number") {
    merged.finalCostingReportAmount = Math.round(assessment * 1.1 * 100) / 100;
  }
  return merged;
}

/** VIN/engine chars shared with the API: deterministic engine number derivation */
function deriveEngineNumber(vin: string): string {
  const seed = vin.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `ENG${seed.slice(-8).padStart(8, "0")}`;
}

function fillClaimTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

export async function generateClaimFormPdf(
  scenario: Scenario,
  settings: AppSettings,
): Promise<Blob> {
  const defaults = settings.defaults;

  const thirdPartyEmail = `${(scenario.thirdPartyName ?? "").toLowerCase().replace(/\s+/g, "")}.${(scenario.thirdPartySurname ?? "").toLowerCase().replace(/\s+/g, "")}@yahoo.com`;
  const thirdPartyContactPerson =
    `${scenario.thirdPartyName ?? ""} ${scenario.thirdPartySurname ?? ""}`.trim();

  const data: Record<string, string> = {
    claimNumber: scenario.claimNumber ?? "",
    accidentReportNumber:
      truncateAccidentReportNumber(scenario.accidentReportNumber) ?? "",
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
    thirdPartyEngineNumber: deriveEngineNumber(
      scenario.thirdPartyVehicleVin ?? scenario.claimNumber,
    ),
    thirdPartyLicencePlate: scenario.thirdPartyLicencePlate ?? "",
    thirdPartyInsuranceCompany: scenario.thirdPartyInsuranceCompany ?? "",
    thirdPartyPolicyNumber: scenario.thirdPartyPolicyNumber ?? "",
    thirdPartyVersion: scenario.thirdPartyVersion ?? "",
    heroLogo: "",
  };

  const { default: rawTemplate } =
    await import("../../templates/claim-form-template.html?raw");
  const filledHtml = fillClaimTemplate(rawTemplate as string, data);

  // Extract <style> and <body> from the full HTML document string so that
  // the CSS is actually applied before html2canvas captures the element.
  const styleMatch = filledHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const bodyMatch = filledHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleContent = styleMatch?.[1] ?? "";
  const bodyContent = bodyMatch?.[1] ?? filledHtml;

  const styleEl = document.createElement("style");
  styleEl.textContent = styleContent;
  document.head.appendChild(styleEl);

  // A4 width in pixels at 96 dpi ≈ 794px; set explicitly so layout matches the template.
  const container = document.createElement("div");
  container.innerHTML = bodyContent;
  container.style.cssText =
    "position:absolute;left:-99999px;width:794px;background:#dadadd;";
  document.body.appendChild(container);

  const html2pdf = (await import("html2pdf.js")).default as (
    element?: unknown,
  ) => {
    from: (el: HTMLElement) => {
      set: (opts: Record<string, unknown>) => {
        outputPdf: (type: string) => Promise<Blob>;
      };
    };
  };

  try {
    const blob = await html2pdf()
      .from(container.firstElementChild as HTMLElement)
      .set({
        margin: 0,
        filename: `${scenario.claimNumber ?? "claim"}_third_party_claim_form.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 794,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .outputPdf("blob");

    return blob;
  } finally {
    document.body.removeChild(container);
    document.head.removeChild(styleEl);
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
