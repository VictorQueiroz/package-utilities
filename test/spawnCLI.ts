import { IOptions, spawn } from "child-process-utilities";
import path from "node:path";

export default function spawnCLI(args: string[], options: IOptions = {}) {
  const p = spawn("node", [path.resolve(__dirname, "../index.js"), ...args], {
    ...options,
    stdio: "pipe",
  });
  return {
    ...p,
    /**
     * Parse the stdout output as JSON
     */
    json() {
      const chunks = new Array<string>();
      if (!p.childProcess.stdout) {
        throw new Error("stdout is not available");
      }
      return new Promise((resolve, reject) => {
        p.childProcess.stderr?.pipe(process.stderr);
        p.childProcess.stdout?.on("data", (data) => {
          chunks.push(data);
        });
        p.childProcess.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Process exited with code ${code}`));
          } else {
            resolve(JSON.parse(chunks.join("")));
          }
        });
      });
    },
  };
}
