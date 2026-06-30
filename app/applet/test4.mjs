async function run() {
  const res1 = await fetch("http://localhost:3000/api/auth/forget-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  });
  console.log("forget-password:", res1.status, await res1.text());

  const res2 = await fetch("http://localhost:3000/api/auth/forget-password/email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  });
  console.log("forget-password/email-otp:", res2.status, await res2.text());

  const res3 = await fetch("http://localhost:3000/api/auth/request-password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", redirectTo: "http://localhost:3000" }),
  });
  console.log("request-password-reset:", res3.status, await res3.text());
}
run();
