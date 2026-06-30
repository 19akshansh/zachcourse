import { authClient } from "./src/lib/auth-client.ts";
async function run() {
  const res = await authClient.forgetPassword({
    email: "akshanshsri.edu@gmail.com",
    redirectTo: "http://localhost:3000/reset-password",
  });
  console.log(res);
}
run();
