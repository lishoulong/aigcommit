// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { simpleGit, SimpleGit, SimpleGitOptions } from "simple-git";
import * as Diff2Html from "diff2html";
import * as cheerio from "cheerio";
import axios from "axios";
import clipboard from "./clipboard";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "gen-commit.generateCommitMessage",
    async () => {
      try {
        let currentWorkspacePath = "";
        let activeEditor = vscode.window.activeTextEditor;
        if (activeEditor !== undefined) {
          let activeDocumentUri = activeEditor.document.uri;
          let workspaceFolder =
            vscode.workspace.getWorkspaceFolder(activeDocumentUri);
          if (workspaceFolder !== undefined) {
            currentWorkspacePath = workspaceFolder.uri.fsPath;
          }
        }
        const options = {
          // baseDir: currentWorkspacePath,
          baseDir: "/Users/lishoulong/Documents/toutiao/lib/openai/gen-commit",
          binary: "git",
          maxConcurrentProcesses: 6,
          trimmed: false,
        };
        const diffs = await extractDiffs(options);

        const shotCommit = await questionFromDiffs(diffs);

        await copyToClipboard(shotCommit);
      } catch (e: any) {
        vscode.window.showInformationMessage(`aigcommit error: ${e.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function askGpt3(
  question: string,
  axiosInstance?: any
): Promise<string> {
  return new Promise((res, rej) => {
    const url = "https://openabcd.net/v1/chat/completions";
    const config = vscode.workspace.getConfiguration("aigcommit");
    const apiKey = config.get("apiKey");
    vscode.window.showInformationMessage(`AigCommit is: ${apiKey}`);
    const client =
      axiosInstance ||
      axios.create({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      });

    const params = {
      messages: [{ role: "user", content: question }],
      model: "gpt-3.5-turbo",
    };

    client
      .post(url, params)
      .then(
        (result: {
          data: {
            choices: { message: { content: string | PromiseLike<string> } }[];
          };
        }) => {
          // console.log(params.prompt + result.data.choices[0].text);
          res(result.data.choices[0]?.message?.content);
        }
      )
      .catch((err: any) => {
        console.log(err);
        rej(err);
      });
  });
}

export async function extractDiffs(
  options: Partial<SimpleGitOptions>,
  gitInstance?: any
): Promise<any[]> {
  try {
    vscode.window.showInformationMessage(
      `aigcommit options: ${JSON.stringify(options)}`
    );
    const git: SimpleGit = gitInstance || simpleGit(options);

    // Check if the repository is initialized
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
      vscode.window.showInformationMessage(`Repository initialized.`);
    }

    // Make a first commit if there are no commits yet
    const log = await git.log().catch(() => ({ total: 0 }));
    if (!log.total) {
      await git.add("./*");
      await git.commit("Initial commit");
      vscode.window.showInformationMessage(`First commit done.`);
    }

    // Get the diff
    const diffString = await git.diff(["HEAD"]);

    // Convert to HTML
    const htmlString = Diff2Html.html(diffString, {
      outputFormat: "line-by-line",
    });

    // Load the HTML string
    const $ = cheerio.load(htmlString);

    // Extract the diff information
    const diffs: { fileName: string; changes: string[] }[] = [];

    $(".d2h-file-wrapper").each((i, fileWrapper) => {
      const fileName = $(fileWrapper).find(".d2h-file-name").text();
      const changes: string[] = [];

      $(fileWrapper)
        .find(".d2h-code-line")
        .each((j, lineElement) => {
          const lineText = $(lineElement).find(".d2h-code-line-ctn").text();
          const lineParent = $(lineElement).parent();

          if (lineParent.hasClass("d2h-ins")) {
            changes.push("+ " + lineText);
          } else if (lineParent.hasClass("d2h-del")) {
            changes.push("- " + lineText);
          } else if (lineParent.hasClass("d2h-chg")) {
            changes.push("* " + lineText);
          }
        });

      diffs.push({ fileName, changes });
    });
    return diffs;
  } catch (e: any) {
    throw new Error(`extractDiffs error: ${e.message}`);
  }
}

export async function questionFromDiffs(
  diffs: { fileName: string; changes: string[] }[],
  axiosInstance?: any
): Promise<string> {
  try {
    // Format the question for GPT-3
    const MAX_LENGTH = 3800; // Set this to your desired maximum length
    // Now we have an array of diffs, each of which is an object with a fileName and changes
    let commitMessages = [];
    let currentBatch = "";
    let currentBatchLength = 0;

    for (let diff of diffs) {
      let fileDiffString = `在文件 ${
        diff.fileName
      } 中，进行了以下更改：\n${diff.changes.join("\n")}`;

      // If the file's diff is too large, summarize it
      if (fileDiffString.length > MAX_LENGTH) {
        fileDiffString = `在文件 ${
          diff.fileName
        } 中，进行了以下更改：\n${summarizeDiff(diff)}`;
      }

      // If adding this file's diff would make the batch too large, ask about the current batch and start a new one
      if (currentBatchLength + fileDiffString.length > MAX_LENGTH) {
        const question = `我有一些代码更改需要生成commit信息。${currentBatch}\n在这些更改中， "+" 前缀的行表示新增的代码，"-" 前缀的行表示删除的代码，"*" 前缀的行表示修改的代码。请根据这些信息生成一个描述这些更改的commit信息。`;
        const commitMessage = await askGpt3(question, axiosInstance);
        commitMessages.push(commitMessage);

        // Start a new batch with this file's diff
        currentBatch = fileDiffString;
        currentBatchLength = fileDiffString.length;
      } else {
        // If adding this file's diff wouldn't make the batch too large, add it to the current batch
        currentBatch += "\n\n" + fileDiffString;
        currentBatchLength += "\n\n".length + fileDiffString.length;
      }
    }

    // If there's a batch remaining, ask about it
    if (currentBatch !== "") {
      const question = `我有一些代码更改需要生成commit信息。${currentBatch}\n在这些更改中， "+" 前缀的行表示新增的代码，"-" 前缀的行表示删除的代码，"*" 前缀的行表示修改的代码。请根据这些信息生成一个描述这些更改的commit信息。`;
      const commitMessage = await askGpt3(question, axiosInstance);
      commitMessages.push(commitMessage);
    }

    // After generating the commit messages...
    const commitMessageStr = commitMessages.join("\n\n");
    console.log("commitMessageStr", commitMessageStr);
    const question = `我有一些根据各个文件生成的多个commit信息。${commitMessageStr}\n。请把上面这些多条信息完善成一个单独的 commit 信息，如果是修复 bug 请以 bugfix: 开头，如果是新功能增加请以 feat: 开头。`;
    const shotCommit = await askGpt3(question, axiosInstance);
    return shotCommit;
  } catch (e: any) {
    console.error("Error in questionFromDiffs:", e.message);
    throw new Error(`generate commit message error: ${e.message}`);
  }
}

export async function copyToClipboard(shotCommit: string) {
  const action = await vscode.window.showInformationMessage(
    "Commit messages generated. Click the button below to copy to clipboard.",
    "Copy to Clipboard"
  );
  if (action === "Copy to Clipboard") {
    try {
      clipboard.writeSync(shotCommit);
      vscode.window.showInformationMessage(
        "Commit messages copied to clipboard."
      );
    } catch (e: any) {
      console.error("copyToClipboard error", e);
      throw new Error(`copyToClipboard error: ${e.message}`);
    }
  }
}

export function summarizeDiff(diff: { fileName: string; changes: string[] }) {
  let addedLines = 0;
  let deletedLines = 0;
  let modifiedLines = 0;

  for (let change of diff.changes) {
    if (change.startsWith("+")) {
      addedLines++;
    } else if (change.startsWith("-")) {
      deletedLines++;
    } else if (change.startsWith("*")) {
      modifiedLines++;
    }
  }

  return `文件 ${diff.fileName} 进行了以下改动：新增了 ${addedLines} 行代码，删除了 ${deletedLines} 行代码，修改了 ${modifiedLines} 行代码。`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
