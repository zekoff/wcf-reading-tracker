export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Sign-in link expired or invalid</h1>
      <p className="text-gray-600">
        Please request a new magic link and try again.
      </p>
    </div>
  );
}
