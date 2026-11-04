/// Required on every deal page. These are the limits of what the contract can promise, stated
/// before anyone asks. See docs/SECURITY.md.
export function NotPromised({ repo }: { repo?: string }) {
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h3>What this does not promise</h3>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
        <li style={{ marginBottom: 6 }}>
          The commit hash proves what that commit contains. It does not prove that commit was the
          one visitors saw that day: the checker chooses which commit to report, and anyone can
          compare it with{" "}
          {repo ? (
            <a href={`https://github.com/${repo}/commits`} target="_blank" rel="noreferrer">
              the public history
            </a>
          ) : (
            "the public history"
          )}
          .
        </li>
        <li style={{ marginBottom: 6 }}>
          Only the exact raw line in the pinned file counts. A logo hosted somewhere else can
          disappear while the line stays, and a remote image is not covered.
        </li>
        <li style={{ marginBottom: 6 }}>
          Matching is literal text, not meaning. A reformatted line counts as missing.
        </li>
        <li style={{ marginBottom: 6 }}>
          There is no dispute mechanism. A dishonest checker is visible and bounded, not
          prevented: it can only choose, per day, between paying the maintainer and refunding
          the sponsor.
        </li>
        <li>If the repo is deleted, its evidence goes with it.</li>
      </ul>
    </section>
  );
}
