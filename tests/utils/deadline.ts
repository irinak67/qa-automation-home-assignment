// Closing the transport on expiry is the caller's responsibility: racing a
// promise alone does not cancel a pending network operation.
export async function withinDeadline<T>(
  operation: () => Promise<T>, timeoutMs: number, onTimeout: () => void, message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
      onTimeout();
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
