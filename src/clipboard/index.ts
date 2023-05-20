import process from "node:process";
import termux from "./lib/termux";
import macos from "./lib/macos";

interface PlatformLib {
  copy: (options: { input: string }) => Promise<void>;
  paste: (options: {
    stripFinalNewline: boolean;
  }) => Promise<string | undefined>;
  copySync: (options: { input: string }) => void;
  pasteSync: (options: { stripFinalNewline: boolean }) => string | undefined;
}

const platformLib: PlatformLib = (() => {
  switch (process.platform) {
    case "darwin":
      return macos;
    case "android":
      if (process.env.PREFIX !== "/data/data/com.termux/files/usr") {
        throw new Error(
          "You need to install Termux for this module to work on Android: https://termux.com"
        );
      }

      return termux;
    default:
      return macos;
  }
})();

const clipboard = {
  write: async (text: string) => {
    if (typeof text !== "string") {
      throw new TypeError(`Expected a string, got ${typeof text}`);
    }

    await platformLib.copy({
      input: text,
    });
  },
  read: async () =>
    platformLib.paste({
      stripFinalNewline: false,
    }),
  writeSync: (text: string) => {
    if (typeof text !== "string") {
      throw new TypeError(`Expected a string, got ${typeof text}`);
    }

    platformLib.copySync({
      input: text,
    });
  },
  readSync: () =>
    platformLib.pasteSync({
      stripFinalNewline: false,
    }),
};

export default clipboard;
