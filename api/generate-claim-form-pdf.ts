/// <reference path="./chromium.d.ts" />
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";

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
  accidentReportNumber?: string;
  accidentDate?: string;
  accidentTime?: string;
  accidentPlace?: string;
  thirdPartyVehicleColour?: string;
}

interface AppSettings {
  defaults: {
    thirdPartyId?: string;
    firstPartyName?: string;
    firstPartySurname?: string;
    firstPartyId?: string;
    firstPartyVehicle?: string;
    firstPartyVehicleColour?: string;
    firstPartyVehicleRegistration?: string;
  };
}

interface GenerateClaimFormPdfRequestBody {
  scenario: Scenario;
  settings?: AppSettings;
}

/** Derive a deterministic engine-number-style string from the VIN. */
function deriveEngineNumber(vin: string): string {
  const seed = vin.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `ENG${seed.slice(-8).padStart(8, "0")}`;
}

function fillTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

function logoDataUrl(): string {
  try {
    const logoPath = join(process.cwd(), ".cursor", "skills", "naked-pdf", "assets", "naked.png");
    const buf = readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function footerTemplate(logoUrl: string): string {
  const logo = logoUrl
    ? `<img src="${logoUrl}" style="width:12px;height:12px;border-radius:3px;display:block;flex:none;" alt="Naked" />`
    : `<div style="width:12px;height:12px;border-radius:3px;background:#3fc37b;flex:none;"></div>`;

  return `
    <div style="width:100%;padding:0 15mm 4px;background:#d3d3d5;color:#5c5c5c;font-family:Arial,Helvetica,sans-serif;font-size:8px;line-height:1.3;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="display:flex;align-items:center;gap:6px;min-width:0;max-width:84%;">
        ${logo}
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Confidential. For internal use only. Do not distribute outside Naked Financial Technology Pty Ltd without approval.</span>
      </div>
      <div style="white-space:nowrap;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>
    </div>
  `;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { scenario, settings } = req.body as GenerateClaimFormPdfRequestBody;
  if (!scenario) {
    res.status(400).json({ error: "Missing required field: scenario" });
    return;
  }

  const defaults = settings?.defaults ?? {};

  const thirdPartyEmail = `${(scenario.thirdPartyName ?? "").toLowerCase().replace(/\s+/g, "")}.${(scenario.thirdPartySurname ?? "").toLowerCase().replace(/\s+/g, "")}@yahoo.com`;
  const thirdPartyContactPerson = `${scenario.thirdPartyName ?? ""} ${scenario.thirdPartySurname ?? ""}`.trim();

  const logo = logoDataUrl();

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
    heroLogo: logo
      ? `<img class="hero-logo" src="${logo}" alt="Naked" />`
      : "",
  };

  try {
    const templatePath = join(process.cwd(), "templates", "claim-form-template.html");
    let template: string;
    try {
      template = readFileSync(templatePath, "utf-8");
    } catch {
      res.status(500).json({ error: "Claim form template not found" });
      return;
    }

    const filledHtml = fillTemplate(template, data);

    const puppeteer = await import("puppeteer-core");

    let executablePath: string;
    let args: string[];

    if (process.platform === "darwin") {
      executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    } else {
      const chromium = await import("@sparticuz/chromium");
      executablePath = await chromium.default.executablePath();
      args = chromium.default.args;
    }

    const browser = await puppeteer.default.launch({
      args,
      defaultViewport: null,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(filledHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(logo),
      margin: { top: "0", right: "0", bottom: "14mm", left: "0" },
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="third-party-claim-form-${scenario.claimNumber ?? "claim"}.pdf"`,
    );
    res.status(200).send(Buffer.from(pdfBuffer));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: `PDF generation failed: ${msg}` });
  }
}
