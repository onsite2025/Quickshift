import "server-only";
import {
  initializeApp,
  getApps,
  cert,
  App,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";

let app: App;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  } else {
    app = initializeApp({ credential: applicationDefault(), storageBucket });
  }
} else {
  app = getApps()[0]!;
}

const _adminDb = getFirestore(app);
try {
  _adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  // settings can only be set once; ignore on hot reload
}
export const adminDb: Firestore = _adminDb;
export const adminAuth: Auth = getAuth(app);
export const adminStorage: Storage = getStorage(app);
