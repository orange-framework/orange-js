import { spawn } from "child_process";

export async function exec(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const wrangler = spawn(command, args);
    const output: { type: "stdout" | "stderr"; data: string }[] = [];

    wrangler.stdout.on("data", (data) => {
      output.push({ type: "stdout", data: data.toString() });
    });

    wrangler.stderr.on("data", (data) => {
      output.push({ type: "stderr", data: data.toString() });
    });

    wrangler.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        for (const o of output) {
          if (o.type === "stderr") {
            process.stderr.write(o.data);
          } else {
            process.stdout.write(o.data);
          }
        }

        reject(new Error(`wrangler types failed with exit code ${code}`));
      }
    });
  });
}
