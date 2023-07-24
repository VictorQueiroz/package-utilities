#!/usr/bin/env node

import * as glob from "glob";
import path from "path";
import fs from "fs";
import assert from "assert";
import { getNamedArgument, getString } from "cli-argument-helper";

function getPath(args: string[], name: string) {
  let value = getNamedArgument(args, name, getString);
  if (value !== null) {
    if (!path.isAbsolute(value)) {
      value = path.resolve(process.cwd(), value);
    }
  }
  return value;
}

function getPaths(args: string[], name: string) {
  const maybePattern = getPath(args, name);
  if (maybePattern !== null) {
    if (glob.hasMagic(maybePattern)) {
      return glob.sync(maybePattern);
    }
    return [maybePattern];
  }
  return null;
}

// --es-folder ./es --include "src/**/*.js"
async function setEsPaths(args: string[]) {
  const includeFiles = new Set(getPaths(args, "--include"));
  const excludeFiles = getPaths(args, "--exclude");
  assert.strict.ok(includeFiles !== null && includeFiles.size > 0);
  if (excludeFiles) {
    for (const e of excludeFiles) {
      includeFiles.delete(e);
    }
  }
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
  const browser: Record<string, string> = {};
  for (const f of includeFiles) {
    const originalFileRelativePath = f.replace(
      new RegExp(`^${process.cwd()}/?`),
      ""
    );
    const esEquivalent = `${path.basename(
      esFolder
    )}/${originalFileRelativePath}`;
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
