export default function Forbidden() {
  return (
    <main className="access-state">
      <p className="access-mark" aria-hidden="true" />
      <h1>This edition is private.</h1>
      <p>Sign in with the ChatGPT account that owns this newspaper to continue.</p>
    </main>
  );
}
