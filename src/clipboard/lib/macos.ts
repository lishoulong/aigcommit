import execa from "execa";

interface Options {
  input?: string;
  stripFinalNewline?: boolean;
}

interface Clipboard {
  copy: (options: Options) => Promise<void>;
  paste: (options: Options) => Promise<string>;
  copySync: (options: Options) => void;
  pasteSync: (options: Options) => string;
}

const env = {
  LC_CTYPE: "UTF-8",
};

const clipboard: Clipboard = {
  copy: async (options) => {
    await execa("pbcopy", { input: options.input, env });
  },
  paste: async (options) => {
    const { stdout } = await execa("pbpaste", { input: options.input, env });
    return stdout;
  },
  copySync: (options) => {
    execa.sync("pbcopy", { input: options.input, env });
  },
  pasteSync: (options) => {
    return execa.sync("pbpaste", { input: options.input, env }).stdout;
  },
};

export default clipboard;
