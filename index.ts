#!/usr/bin/env node

import * as glob from "glob";
import getString from "./getString";
import path from "path";
import fs from "fs";
import assert from "assert";

function getPath(args: string[], name: string) {
  let value = getString(args, name);
  if (value !== null) {
    if (!path.isAbsolute(value)) {
      value = path.resolve(process.cwd(), value);
    }
  }
  return value;
}

// --es-folder ./es --include "src/**/*.js"
async function setEsPaths(args: string[]) {
  const includeFiles = new Array<string>();
  let includePattern: string | null;
  do {
    includePattern = getPath(args, "--include");
    if (includePattern !== null) {
      includeFiles.push(...glob.sync(includePattern));
    }
  } while (includePattern !== null);
  assert.strict.ok(includeFiles.length > 0);
  const esFolder = getPath(args, "--es-folder");
  assert.strict.ok(esFolder !== null);
  let inOutPackageJsonFile =
    getPath(args, "--package-json-file") ??
    path.resolve(process.cwd(), "package.json");
  const stringifiedPackageJson = await fs.promises.readFile(
    inOutPackageJsonFile,
    "utf8"
  );
  let packageJson: Record<string, unknown> = JSON.parse(stringifiedPackageJson);
  /**
   * reset browser
   */
  packageJson["browser"] = {};
  for (const f of includeFiles) {
    const originalFileRelativePath = f.replace(
      new RegExp(`^${process.cwd()}/`),
      ""
    );
    const esEquivalent = `es/${originalFileRelativePath}`;
    const browser = packageJson["browser"] as Record<string, string>;
    packageJson = {
      ...packageJson,
      browser: {
        ...browser,
        [`./${originalFileRelativePath}`]: `./${esEquivalent}`,
      },
    };
  }

  const lastCharacter =
    stringifiedPackageJson[stringifiedPackageJson.length - 1] === "\n"
      ? "\n"
      : "";
  await fs.promises.writeFile(
    inOutPackageJsonFile,
    `${JSON.stringify(packageJson, null, 2)}${lastCharacter}`
  );
}

(async () => {
  const args = process.argv.slice(2);
  let i = 0;
  while (args.length > 0) {
    switch (args[i]) {
      case "--set-es-paths":
        args.shift();
        await setEsPaths(args);
        break;
      default:
        throw new Error(`unknown argument: ${args[i]}`);
    }
  }
})().catch((reason) => {
  console.error("execution failed with error: %o", reason);
  process.exitCode = 1;
});
