const core = require("@actions/core");
const github = require("@actions/github");
const { Octokit } = require("@octokit/rest")

async function run() {
  try {
    // load approvers from the config file
    const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
    const octokit =  new Octokit();
    console.log(`GITHUB_TOKEN: ${GITHUB_TOKEN}`);
    const { context = {} } = github;
    const { pull_request } = context.payload;
    const { owner, repo } = context.repo;
    console.log(`pull_request: ${JSON.stringify(pull_request)}`);
    let teamMembers_file = await octokit.repos.getContent({
      owner,
      repo,
      path: ".github/approvers.json",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
        accept: "application/json",
      },
    });

    let teamMembers = JSON.parse(
      Buffer.from(teamMembers_file.data.content, "base64").toString("utf-8")
    );

    console.log(teamMembers);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
