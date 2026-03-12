declare module "@sparticuz/chromium" {
  export function executablePath(
    options?: { path?: string }
  ): Promise<string>;
  export const args: string[];
  export const headless: boolean;
  export const path: string;
}
