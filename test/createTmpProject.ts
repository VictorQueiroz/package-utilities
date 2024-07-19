import fs from "fs";
import os from "os";
import path from "path";

export default async function createTmpProject({
  files,
}: {
  /**
   * Map of relative paths with their respective content to be created in the temporary project
   */
  files: Map<string, string> | Record<string, string>;
}) {
  const tmpDir = await fs.promises.mkdtemp(`${os.tmpdir()}/package-utilities-`);
  if (!(files instanceof Map)) {
    files = new Map(Object.entries(files));
  }

  for (const [relativePath, content] of files) {
    const filePath = path.resolve(tmpDir, relativePath);
    const parentFolder = path.dirname(filePath);
    try {
      await fs.promises.access(parentFolder, fs.constants.R_OK);
    } catch (reason) {
      await fs.promises.mkdir(parentFolder, { recursive: true });
    }
    await fs.promises.access(parentFolder, fs.constants.W_OK);
    await fs.promises.writeFile(filePath, content);
  }

  return {
    location: tmpDir,
    async read(relativePath: string) {
      return await fs.promises.readFile(
        path.resolve(tmpDir, relativePath),
        "utf8"
      );
    },
    async destroy() {
      await fs.promises.rm(tmpDir, { recursive: true });
    },
  };
}
