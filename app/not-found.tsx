import Link from "next/link";

export default function NotFound() {
  return (
    <main className="empty">
      <h1>That piece isn't on the rack</h1>
      <p>It may have sold out or been taken down.</p>
      <Link className="btn btn--primary" href="/">
        Back to the rack
      </Link>
    </main>
  );
}
