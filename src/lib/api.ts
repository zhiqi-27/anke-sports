import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

function firebaseAuth() {
  if (
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
    return null;
  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  return getAuth(app);
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const auth = firebaseAuth();
  if (auth) {
    await auth.authStateReady();
    if (auth.currentUser)
      headers.set(
        "Authorization",
        `Bearer ${await auth.currentUser.getIdToken()}`,
      );
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error?.code || "REQUEST_FAILED",
      body.error?.message || "请求未完成，请稍后重试",
      response.status,
    );
  }
  return response;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await request(path, init)).json();
}
export async function googleLogin() {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Firebase 登录尚未配置");
  await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function logout() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
  await api("/auth/logout", { method: "POST" });
}
export async function download(path: string, name: string) {
  const response = await request(path);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
