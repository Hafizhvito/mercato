export default function NotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-zinc-900">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-zinc-600">The requested page could not be found.</p>
        <a
          href="/"
          className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Return Home
        </a>
      </body>
    </html>
  );
}
