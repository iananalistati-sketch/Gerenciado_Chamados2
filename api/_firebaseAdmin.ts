import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  Auth,
  getAuth,
} from "firebase-admin/auth";

export function getAdminAuth(): Auth {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  let privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Variáveis do Firebase Admin não configuradas."
    );
  }

  /*
   * Remove aspas externas caso tenham sido
   * incluídas acidentalmente na Vercel.
   */
  privateKey = privateKey
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

  return getAuth(app);
}