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
  let includeFiles = new Set<string>();
  let lastFiles: string[] | null;
  do {
    lastFiles = getPaths(args, "--include");
    if (lastFiles) {
      includeFiles = new Set([...lastFiles, ...includeFiles]);
    }
  } while (lastFiles !== null);
  /**
   * exclude undesired files
   */
  do {
    lastFiles = getPaths(args, "--exclude");
    if (lastFiles) {
      for (const e of lastFiles) {
        includeFiles.delete(e);
      }
    }
  } while (lastFiles !== null);
  /**
   * make sure there is at least one file included
   */
  assert.strict.ok(includeFiles.size > 0);
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
  let browser: Record<string, string> = {};
  for (const f of includeFiles) {
    const originalFileRelativePath = f.replace(
      new RegExp(`^${process.cwd()}/?`),
      ""
    );
    const esEquivalent = `${path.basename(
      esFolder
    )}/${originalFileRelativePath}`;
    browser = {
      ...browser,
      [`./${originalFileRelativePath}`]: `./${esEquivalent}`,
    };
    packageJson = {
      ...packageJson,
      browser,
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
