/// Required on every deal page. These are the limits of what the contract can promise, stated
/// before anyone asks. See docs/SECURITY.md.
export function NotPromised({ repo }: { repo?: string }) {
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h3>What this does not promise</h3>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
        <li style={{ marginBottom: 6 }}>
          The checker chooses which commit to read. Every reported commit is checked on the deal
          page: it must be in the pinned branch&apos;s history, and the file at that commit must
          match the hash recorded on chain. What cannot be proved yet is that it was the branch&apos;s
          latest commit at that minute; anyone can compare it with{" "}
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
          What counts is the exact line in the pinned file, plus any image the line shows from the
          repository itself, which must be in the same commit. Images hosted elsewhere are not
          covered: another server can show the checker one picture and visitors another.
        </li>
        <li style={{ marginBottom: 6 }}>
          Matching is literal text, on purpose, so there is never an argument about whether a line
          counts. A reformatted line counts as missing.
        </li>
        <li style={{ marginBottom: 6 }}>
          There is no dispute mechanism. A dishonest checker is visible and bounded, not
          prevented: it can only choose, per day, between paying the maintainer and refunding the
          sponsor.
        </li>
        <li>
          If the repository is deleted, its commit links stop working. Each day&apos;s file hash
          stays on chain, so anyone holding a copy of the file can still show it is the one that
          was read.
        </li>
      </ul>
    </section>
  );
}
