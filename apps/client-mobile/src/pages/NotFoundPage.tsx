import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="oc-container py-16 text-center">
      <h1 className="text-3xl font-bold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This page does not exist.</p>
      <Link to="/" className="mt-6 inline-block text-gold hover:underline">
        Go home
      </Link>
    </div>
  );
}
