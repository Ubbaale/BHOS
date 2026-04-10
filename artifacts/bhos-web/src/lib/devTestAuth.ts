if (import.meta.env.DEV) {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const testEmail = localStorage.getItem("x-test-user-email");
    if (testEmail) {
      const headers = new Headers(init?.headers);
      headers.set("x-test-user-email", testEmail);
      return originalFetch.call(this, input, { ...init, headers });
    }
    return originalFetch.call(this, input, init);
  };
}
