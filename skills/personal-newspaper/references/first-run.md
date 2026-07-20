# First-run installation

## Contents

- Ownership boundary
- Create the reader's Sites project
- Interview and publish edition one
- Install the daily schedule
- Completion contract

## Ownership boundary

Create a new site and data plane for every reader. Never reuse a `project_id`, URL, credential, D1 database, R2 bucket, edition, profile, or screenshot from the plugin repository or its public example.

Do not ask the reader to configure Sites, storage, deployment, tokens, environment variables, source control, or package tools. Those are internal setup steps. If a required Codex capability is unavailable, report the single missing capability instead of substituting an unverified host or manual secret workflow.

## Create the reader's Sites project

1. Resolve the directory containing the loaded `SKILL.md`. If the current project does not contain this newspaper app, require a new or empty project and run its `scripts/bootstrap-project.mjs` with `--target` set to the project root. Refuse to copy into a non-empty project.
2. Confirm `.openai/hosting.json` contains only the logical `d1` and `r2` bindings and no `project_id`. Install the locked dependencies with pnpm. Use the Sites capability workflow, including `sites-building` before `sites-hosting`; do not invent deployment commands.
3. Generate a cryptographically random 32-byte publication credential. Create `.personal-newspaper/runtime.env` with mode `0600`, containing only `PAPER_URL` and `AUTOMATION_TOKEN`; leave `PAPER_URL` empty until deployment succeeds. Never print the file or credential.
4. Use `Sites:create_site` exactly once, immediately persist its opaque id as `project_id`, and use `Sites:update_environment_variables` to set `AUTOMATION_TOKEN` as a secret. Build, push, save, and privately deploy the exact source through the Sites workflow. Poll the deployment to a terminal result. On success, write the returned production URL to `PAPER_URL` in the private runtime file without changing the credential.
5. Open the reader's deployed URL. Do not continue if the site is not reachable or if its project id differs from the one just created.

## Interview and publish edition one

1. Ask one question at a time for only: owner email when authentication does not supply it, masthead, language, timezone, daily publication time, interests, and explicit exclusions. Do not ask about layout templates, tracking topics, deployment, storage, or credentials.
2. Write the confirmed profile to a private temporary JSON file. Load the private runtime file into the process and run:

   ```bash
   pnpm profile:save -- --file "$PROFILE_FILE" --url "$PAPER_URL"
   ```

3. Read `pipeline.md`, `edition-contract.md`, and `base-design.md` completely. Execute **Publish now** from `SKILL.md` for the reader's language. Delete the temporary profile file on every exit path.
4. Verify the current manifest, open every article from the whole newspaper package, exercise like and dislike through saved and reload-persisted states, and confirm original-source links appear only in article detail. Do not schedule on partial success.

## Install the daily schedule

Publish and verify edition one before any schedule mutation.

1. Use `list_projects` to resolve the unique nearest ancestor project of the generated project root. Stop on no match or an ambiguous nearest match.
2. Inspect existing automations. A candidate has either the previously saved automation id, or both the exact name `Personal Newspaper daily edition` and exact project id. Prompt text is repairable configuration, not identity. Stop if multiple candidates exist.
3. Use `automation_update` to update the one candidate or create one only when none exists. Configure one active local cron automation at the confirmed local time, against the resolved project, with failed-runs-only notifications unless the reader asks otherwise. Use the exact prompt in `SKILL.md`.
4. Verify the automation is active, points to the correct project, shows the expected next local run, and has a byte-for-byte equal prompt. Never create a duplicate to repair a stale prompt.

## Completion contract

Setup is complete only when all four facts are proven:

1. The site belongs to this reader and is reachable.
2. Edition one is published and passes live browser verification.
3. Exactly one active daily automation targets the generated project.
4. The private runtime file exists locally and is ignored by source control.

The setup task may end after these checks. The schedule is installed, but unattended publishing is not proven until a scheduled run publishes an edition and passes live verification.
