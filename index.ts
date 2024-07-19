#!/usr/bin/env node

import { glob } from "glob";
import path from "path";
import fs from "fs";
import assert from "assert";
import getNamedArgument from "cli-argument-helper/getNamedArgument";
import { getString } from "cli-argument-helper/string";
import { getArgument } from "cli-argument-helper";
import chalk from "chalk";

enum OutputMode {
  Write,
  Stdout,
}

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
      return glob(maybePattern);
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
    lastFiles = await getPaths(args, "--include");
    if (lastFiles) {
      includeFiles = new Set([...lastFiles, ...includeFiles]);
    }
  } while (lastFiles !== null);
  /**
   * exclude undesired files
   */
  do {
    lastFiles = await getPaths(args, "--exclude");
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
    getPath(args, "--package-json-file") ?? "package.json";
  if (inOutPackageJsonFile === null) {
    inOutPackageJsonFile = path.resolve(process.cwd(), inOutPackageJsonFile);
  }
  let rootDir = getPath(args, "--root-dir");
  if (rootDir === null) {
    rootDir = process.cwd();
  } else {
    rootDir = path.resolve(process.cwd(), rootDir);
  }
  const stringifiedPackageJson = await fs.promises.readFile(
    inOutPackageJsonFile,
    "utf8"
  );
  let outputMode: OutputMode;
  if (getArgument(args, "--write") !== null) {
    outputMode = OutputMode.Write;
  } else {
    console.error(
      `${chalk.yellow("Behavior warning:")}\n` +
        "\t" +
        chalk.cyan(
          "Be aware that the default behavior has changed! Previously, the CLI would always write to the package.json. " +
            "Now the default behavior is to write the new `package.json` to `process.stdout`. " +
            "If you want to write to the `package.json` file, please pass the `--write` argument."
        )
    );
    outputMode = OutputMode.Stdout;
  }
  let packageJson: Record<string, unknown> = JSON.parse(stringifiedPackageJson);
  /**
   * ES module paths
   */
  const browser = new Map<string, string>();
  for (const f of includeFiles) {
    const originalFileRelativePath = f.replace(new RegExp(`^${rootDir}/?`), "");
    const esEquivalent = `${path.basename(
      esFolder
    )}/${originalFileRelativePath}`;

    browser.set(
      `./${path.relative(path.dirname(inOutPackageJsonFile), f)}`,
      `./${esEquivalent}`
    );
  }

  await Promise.all(
    Array.from(browser.values()).map((b) =>
      fs.promises.access(b, fs.constants.R_OK).catch((reason) => ({
        message: `Failed to access "${b}" with error: ${reason}`,
      }))
    )
  );

  packageJson = {
    ...packageJson,
    browser: Object.fromEntries(browser),
  };

  const lastCharacter =
    stringifiedPackageJson[stringifiedPackageJson.length - 1] === "\n"
      ? "\n"
      : "";

  switch (outputMode) {
    case OutputMode.Write:
      await fs.promises.writeFile(
        inOutPackageJsonFile,
        `${JSON.stringify(packageJson, null, 2)}${lastCharacter}`
      );
      break;
    case OutputMode.Stdout:
      process.stdout.write(
        `${JSON.stringify(packageJson, null, 2)}${lastCharacter}\n`
      );
  }
}

const help = [
  "Usage: npx pkg-utilities [options]",
  "Description: Essential utilities for Node.js packages",
  "Options:",
  "--set-es-paths " +
    "; Create the `browser` property on your `package.json` file based on the files matched by the `--include` argument. " +
    "The --es-folder argument defines the folder where the ES modules are. For example:",
  [
    'npx pkg-utilities --set-es-paths --es-folder "./es" --include "dist/src/**/*.js"',
    'Would result in the following "browser" property:',
    "",
    "{",
    [
      '"./dist/src/index.js": "./es/dist/src/index.js"',
      '"./dist/src/other.js": "./es/dist/src/other.js"',
    ],
    "}",
    "",
    "",
    "The --root-dir argument defines the root directory where the files will be inside the ES folder. For example:",
    "",
    'npx pkg-utilities --set-es-paths --es-folder "./es" --include "dist/src/**/*.js" --root-dir "dist"',
    'Would result in the following "browser" property:',
    "",
    "{",
    [
      '"./dist/src/index.js": "./es/src/index.js"',
      '"./dist/src/other.js": "./es/src/other.js"',
    ],
    "}",
    "If the --root-dir argument is not set, it will use the current directory where the CLI is being executed.",
    "",
  ],
  [
    "--es-folder <path> ; Defines the folder where the ES modules will be stored",
    "--include <path> ; Glob pattern to include files",
    "--exclude <path> ; Glob pattern to exclude files",
    "--package-json-file <path> ; Defines the package.json file. If not set, " +
      "it will use the package.json file on the current directory where the CLI is being executed.",
    "--root-dir <path> ; Defines the root directory where the files will be inside the ES folder.",
    "--write ; Write the changes on the package.json file",
  ],
];

function printHelp(currentHelpItem: typeof help, indent = "") {
  for (const line of currentHelpItem) {
    if (Array.isArray(line)) {
      printHelp(
        line,
        `${indent}${Array.from({ length: 4 }).fill(" ").join("")}`
      );
    } else {
      process.stdout.write(`${indent}${line}\n`);
    }
  }
}

(async () => {
  const args = process.argv.slice(2);

  if ((getArgument(args, "--help") ?? getArgument(args, "-h")) !== null) {
    printHelp(help);
  }

  if (getArgument(args, "--set-es-paths") !== null) {
    await setEsPaths(args);
  }

  if (args.length > 0) {
    process.exitCode = 1;
    for (const arg of args) {
      console.error(`Unknown argument: ${arg}`);
    }
  }
})().catch((reason) => {
  console.error("execution failed with error: %o", reason);
  process.exitCode = 1;
});
