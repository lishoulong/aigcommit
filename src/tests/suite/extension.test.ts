import * as assert from "assert";
import {
  askGpt3,
  extractDiffs,
  questionFromDiffs,
  summarizeDiff,
} from "../../extension";
import { SimpleGitOptions } from "simple-git";

suite("Extension Test Suite", () => {
  test("summarizeDiff Test", () => {
    const mockDiff = {
      fileName: "test.js",
      changes: [
        "+ added line",
        "- removed line",
        "- removed another line",
        "* modified line",
      ],
    };
    const expectedResult =
      "文件 test.js 进行了以下改动：新增了 1 行代码，删除了 2 行代码，修改了 1 行代码。";
    const result = summarizeDiff(mockDiff);

    assert.strictEqual(result, expectedResult);
  });

  test("askGpt3 Test", async () => {
    // Set up the needed mocked values and functions.
    // Bypass axios, so the test will not call the real GPT API.
    const mockedResponse = "This is the response of the API.";
    const apiResponse = {
      data: { choices: [{ message: { content: mockedResponse } }] },
    };
    const axiosMock = { post: async () => apiResponse };
    const question = "This is the question.";

    // Pass the mocked values to the function.
    const result = await askGpt3(question, axiosMock);

    // Check if the function returns the expected result.
    assert.strictEqual(result, mockedResponse);
  });

  test("extractDiffs Test", async () => {
    // Mock the simpleGit library with a basic example diff string.
    const gitMock: any = {
      diff: async () => "diff --git a/test.js b/test.js\n",
    };
    const simpleGitOptions: Partial<SimpleGitOptions> = {
      baseDir: "/test/base/dir",
      binary: "git",
      maxConcurrentProcesses: 6,
      trimmed: false,
    };

    const result = await extractDiffs(simpleGitOptions, gitMock);

    // Check if the function returns the fileName and changes as expected.
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].fileName, "test.js");
    assert.strictEqual(result[0].changes.length, 0);
  });

  test("questionFromDiffs Test", async () => {
    const mockDiffs = [
      {
        fileName: "test.js",
        changes: [
          "+ added line",
          "- removed line",
          "- removed another line",
          "* modified line",
        ],
      },
    ];
    const mockedResponse = "This is the response of the API.";
    const apiResponse = {
      data: { choices: [{ message: { content: mockedResponse } }] },
    };
    const axiosMock = { post: async () => apiResponse };

    const result = await questionFromDiffs(mockDiffs, axiosMock);

    // Check if the function returns the expected result.
    assert.strictEqual(result, mockedResponse);
  });
});
