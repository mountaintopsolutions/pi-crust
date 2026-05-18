import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePackageExtensions, resolveSinglePackageExtensions } from "../../src/extensions/packages.js";
import { createTempPrcHome, type TempPrcHome } from "../helpers/temp-prc-home.js";
import { writeLocalExtensionPackage } from "../helpers/local-extension-package.js";

let homes: TempPrcHome[] = [];

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => home.cleanup()));
});

describe("PRC extension package resolver", () => {
  it("resolves a package.json piRemoteControl.extension entry", async () => {
    const home = await makeHome();
    const packageDir = await writeLocalExtensionPackage(home.root, { extensionFile: "src/extension.mjs" });

    const entries = await resolveSinglePackageExtensions(packageDir);

    expect(entries).toEqual([path.join(packageDir, "src", "extension.mjs")]);
  });

  it("resolves package extension include/exclude patterns", async () => {
    const home = await makeHome();
    const packageDir = path.join(home.root, "pattern-package");
    await fs.mkdir(path.join(packageDir, "extensions", "nested"), { recursive: true });
    await fs.writeFile(path.join(packageDir, "extensions", "alpha.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "beta.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "nested", "gamma.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "package.json"), JSON.stringify({
      name: "pattern-package",
      piRemoteControl: { extensions: ["extensions/**/*.mjs", "!extensions/beta.mjs"] },
    }));

    const entries = await resolveSinglePackageExtensions(packageDir);

    expect(entries.map((entry) => path.relative(packageDir, entry).split(path.sep).join("/"))).toEqual([
      "extensions/alpha.mjs",
      "extensions/nested/gamma.mjs",
    ]);
  });

  it("auto-discovers extension directories using Pi-like one-level semantics", async () => {
    const home = await makeHome();
    const packageDir = path.join(home.root, "auto-package");
    await fs.mkdir(path.join(packageDir, "extensions", "with-index"), { recursive: true });
    await fs.mkdir(path.join(packageDir, "extensions", "without-index"), { recursive: true });
    await fs.writeFile(path.join(packageDir, "extensions", "direct.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "with-index", "index.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "with-index", "helper.mjs"), "export const helper = true;\n");
    await fs.writeFile(path.join(packageDir, "extensions", "without-index", "helper.mjs"), "export const helper = true;\n");

    const entries = await resolveSinglePackageExtensions(packageDir);

    expect(entries.map((entry) => path.relative(packageDir, entry).split(path.sep).join("/"))).toEqual([
      "extensions/direct.mjs",
      "extensions/with-index/index.mjs",
    ]);
  });

  it("uses subdirectory package manifests and lets them take precedence over index files", async () => {
    const home = await makeHome();
    const packageDir = path.join(home.root, "subdir-manifest-package");
    const subdir = path.join(packageDir, "extensions", "panel");
    await fs.mkdir(subdir, { recursive: true });
    await fs.writeFile(path.join(subdir, "index.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(subdir, "actual.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(subdir, "package.json"), JSON.stringify({
      name: "panel",
      piRemoteControl: { extension: "./actual.mjs" },
    }));

    const entries = await resolveSinglePackageExtensions(packageDir);

    expect(entries).toEqual([path.join(subdir, "actual.mjs")]);
  });

  it("layers package setting filters on top of manifest filters", async () => {
    const home = await makeHome();
    const packageDir = path.join(home.root, "layered-package");
    await fs.mkdir(path.join(packageDir, "extensions"), { recursive: true });
    await fs.writeFile(path.join(packageDir, "extensions", "foo.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "bar.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "baz.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "package.json"), JSON.stringify({
      name: "layered-package",
      piRemoteControl: { extensions: ["extensions/*.mjs", "!extensions/baz.mjs"] },
    }));

    const result = await resolvePackageExtensions({ packages: [{ source: packageDir, extensions: ["!extensions/bar.mjs"] }] }, { cwd: home.root });

    expect(result.extensions.map((entry) => path.relative(packageDir, entry.path).split(path.sep).join("/"))).toEqual(["extensions/foo.mjs"]);
  });

  it("supports force include and force exclude patterns", async () => {
    const home = await makeHome();
    const packageDir = path.join(home.root, "force-package");
    await fs.mkdir(path.join(packageDir, "extensions"), { recursive: true });
    await fs.writeFile(path.join(packageDir, "extensions", "alpha.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "beta.mjs"), "export default function() {}\n");
    await fs.writeFile(path.join(packageDir, "extensions", "gamma.mjs"), "export default function() {}\n");

    const entries = await resolveSinglePackageExtensions(packageDir, ["extensions/*.mjs", "!extensions/*.mjs", "+extensions/beta.mjs", "-extensions/gamma.mjs"]);

    expect(entries.map((entry) => path.relative(packageDir, entry).split(path.sep).join("/"))).toEqual(["extensions/beta.mjs"]);
  });

  it("dedupes the same local package in global and project settings with project scope winning", async () => {
    const home = await makeHome();
    const packageDir = await writeLocalExtensionPackage(home.root, { name: "shared-package" });

    const result = await resolvePackageExtensions({ packages: [packageDir], projectPackages: [packageDir] }, { cwd: home.root });

    expect(result.diagnostics).toEqual([]);
    expect(result.extensions).toEqual([{ packageSource: packageDir, path: path.join(packageDir, "index.mjs"), scope: "project" }]);
  });

  it("resolves installed package settings using the supplied cwd", async () => {
    const home = await makeHome();
    const packageDir = await writeLocalExtensionPackage(home.projectRoot, { name: "installed-extension" });

    const result = await resolvePackageExtensions({ packages: ["installed-extension"] }, { cwd: home.projectRoot });

    expect(result.diagnostics).toEqual([]);
    expect(result.extensions).toEqual([{ packageSource: packageDir, path: path.join(packageDir, "index.mjs"), scope: "global" }]);
  });

  it("returns diagnostics for missing package sources", async () => {
    const home = await makeHome();

    const result = await resolvePackageExtensions({ packages: ["missing"] }, { cwd: home.projectRoot });

    expect(result.extensions).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.message).toContain("ENOENT");
  });
});

async function makeHome(): Promise<TempPrcHome> {
  const home = await createTempPrcHome();
  homes.push(home);
  return home;
}
