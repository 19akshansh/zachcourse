import { createAuthClient } from "better-auth/react";
const authClient = createAuthClient();
console.log(authClient.forgetPassword);
console.log(authClient.emailAndPassword);
console.log(Object.keys(authClient).join(', '));
