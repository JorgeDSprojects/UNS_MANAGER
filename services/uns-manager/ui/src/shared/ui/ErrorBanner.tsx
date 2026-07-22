export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="message error" role="alert">
      {message}
    </div>
  );
}
