import fs from "node:fs/promises";
import path from "node:path";

export interface LocalExtensionPackageOptions {
  readonly name?: string;
  readonly extensionFile?: string;
  readonly extensionCode?: string;
  readonly manifest?: Record<string, unknown>;
}

export async function writeLocalExtensionPackage(root: string, options: LocalExtensionPackageOptions = {}): Promise<string> {
  const name = options.name ?? "prc-test-extension";
  const packageDir = path.join(root, name);
  const extensionFile = options.extensionFile ?? "index.mjs";
  await fs.mkdir(path.dirname(path.join(packageDir, extensionFile)), { recursive: true });
  await fs.writeFile(
    path.join(packageDir, extensionFile),
    options.extensionCode ?? "export default function activate(prc) { prc.commands.register({ id: 'test.hello', title: 'Hello', run: () => 'world' }); }\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(options.manifest ?? {
      name,
      version: "0.0.0-test",
      piRemoteControl: { extension: `./${extensionFile}` },
    }, null, 2)}\n`,
    "utf8",
  );
  return packageDir;
}
