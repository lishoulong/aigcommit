import * as path from "path";
import Mocha from "mocha";
import { promisify } from "util";
import * as glob from "glob";
// import { Glob } from "glob";

const globAsync = promisify(glob.glob);

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, "..");

  // Use promisified glob to avoid callback
  const files = (await globAsync("**/**.test.js", {
    cwd: testsRoot,
  })) as string[];

  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  await new Promise<void>((resolve, reject) => {
    // Run the mocha test
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  }).catch((err) => {
    console.error(err);
    throw err;
  });
}
