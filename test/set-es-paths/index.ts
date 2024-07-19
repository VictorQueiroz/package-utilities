import { it } from "node:test";
import path from "node:path";
import spawnCLI from "../spawnCLI";
import { expect } from "chai";
import createTmpProject from "../createTmpProject";

it("should set the `browser` property", async () => {
  expect(
    await spawnCLI(
      ["--set-es-paths", "--es-folder", "./es", "--include", "src/**/*.js"],
      {
        cwd: path.resolve(__dirname, "project"),
      }
    ).json()
  ).to.be.deep.equal({
    main: "index.js",
    browser: { "./src/index.js": "./es/src/index.js" },
  });
});

it("should accept a different root dir", async () => {
  const project = await createTmpProject({
    files: {
      "package.json": JSON.stringify({
        main: "dist/src/index.js",
      }),
      "dist/src/index.js": "exports.a = 1;",
      "es/src/index.js": "export const a = 1;",
    },
  });

  expect(
    await spawnCLI(
      [
        "--set-es-paths",
        "--es-folder",
        "./es",
        "--include",
        "dist/**/*.js",
        "--root-dir",
        "dist",
      ],
      {
        cwd: project.location,
      }
    ).json()
  ).to.be.deep.equal({
    main: "dist/src/index.js",
    browser: { "./dist/src/index.js": "./es/src/index.js" },
  });

  await project.destroy();
});

it('should write to the package.json file if "--write" is passed', async () => {
  const project = await createTmpProject({
    files: {
      "package.json": JSON.stringify({
        main: "dist/src/index.js",
      }),
      "dist/src/index.js": "exports.a = 1;",
      "es/src/index.js": "export const a = 1;",
    },
  });

  await spawnCLI(
    [
      "--set-es-paths",
      "--es-folder",
      "./es",
      "--include",
      "dist/**/*.js",
      "--root-dir",
      "dist",
      "--write",
    ],
    {
      cwd: project.location,
    }
  ).wait();

  expect(
    JSON.stringify(JSON.parse(await project.read("package.json")))
  ).to.be.equal(
    JSON.stringify({
      main: "dist/src/index.js",
      browser: { "./dist/src/index.js": "./es/src/index.js" },
    })
  );

  await project.destroy();
});

it('should not write to the package.json file if "--write" is not passed', async () => {
  const project = await createTmpProject({
    files: {
      "package.json": JSON.stringify({
        main: "dist/src/index.js",
      }),
      "dist/src/index.js": "exports.a = 1;",
      "es/src/index.js": "export const a = 1;",
    },
  });

  await spawnCLI(
    [
      "--set-es-paths",
      "--es-folder",
      "./es",
      "--include",
      "dist/**/*.js",
      "--root-dir",
      "dist",
    ],
    {
      cwd: project.location,
    }
  ).wait();

  expect(
    JSON.stringify(JSON.parse(await project.read("package.json")))
  ).to.be.equal(
    JSON.stringify({
      main: "dist/src/index.js",
    })
  );

  await project.destroy();
});
