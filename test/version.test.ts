/**
 * The card tag and the file name come from package.json at build time
 * (vite.config.ts). hacs.json names the file separately; if the two drift
 * apart, HACS installs a file that does not exist.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Under happy-dom import.meta.url is not a file: URL; vitest runs from the root.
const root = (name: string) => resolve(process.cwd(), name);

const pkg = JSON.parse(readFileSync(root("package.json"), "utf8"));
const hacs = JSON.parse(readFileSync(root("hacs.json"), "utf8"));

describe("identity", () => {
  it("hacs.json points at the file the build produces", () => {
    expect(hacs.filename).toBe(`${pkg.name}.js`);
  });

  it("the version is SemVer, pre-releases as -beta.N", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-beta\.\d+)?$/);
  });
});
