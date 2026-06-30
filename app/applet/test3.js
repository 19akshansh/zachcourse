async function run() {
  const res = await fetch("http://localhost:3000/api/auth/forget-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "akshanshsri.edu@gmail.com",
      redirectTo: "http://localhost:3000/reset-password",
    }),
  });
  console.log(res.status, await res.text());
}
run();
