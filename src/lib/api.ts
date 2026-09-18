import { getApps, initializeApp } from "firebase/app";
import type { AccountDeletion, AuthProfile, CalendarUser } from "./types";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile,
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
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const messages: Record<string, string> = {
      "auth/popup-closed-by-user":
        "登录窗口已关闭，尚未完成登录。请重试，或在 Chrome、Safari 中打开此页面。",
      "auth/popup-blocked":
        "浏览器未能打开登录窗口。请允许弹出窗口，或在 Chrome、Safari 中打开此页面。",
      "auth/cancelled-popup-request":
        "另一条登录请求已开始，请在最新的登录窗口中继续。",
      "auth/network-request-failed":
        "暂时无法连接 Google 登录服务，请检查网络后重试。",
      "auth/unauthorized-domain":
        "此地址尚未开通 Google 登录，请联系维护者配置登录域名。",
      "auth/operation-not-supported-in-this-environment":
        "当前浏览器无法完成 Google 登录，请在 Chrome、Safari 中打开此页面。",
      "auth/web-storage-unsupported":
        "浏览器无法保存登录状态，请允许网站存储，或在 Chrome、Safari 中打开此页面。",
    };
    throw new Error(
      messages[code || ""] ||
        "Google 登录未完成，请重试或在 Chrome、Safari 中打开此页面。",
    );
  }
  // A provider popup succeeding is not proof that our API accepts the identity.
  return api<CalendarUser>("/me/calendar");
}

export async function readAuthProfile(): Promise<AuthProfile | null> {
  const auth = firebaseAuth();
  if (!auth) return null;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  return {
    displayName: user.displayName?.trim() || "",
    photoURL: user.photoURL || null,
  };
}

export async function saveAuthProfile(input: AuthProfile) {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Firebase 登录尚未配置");
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("登录状态已失效，请重新登录");
  await updateProfile(auth.currentUser, {
    displayName: input.displayName || null,
    photoURL: input.photoURL || null,
  });
  return {
    displayName: auth.currentUser.displayName?.trim() || "",
    photoURL: auth.currentUser.photoURL || null,
  } satisfies AuthProfile;
}

export async function logout() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
  await api("/auth/logout", { method: "POST" });
}
export async function deleteAccount() {
  const result = await api<AccountDeletion>("/me", {
    method: "DELETE",
    body: JSON.stringify({ confirmed: true }),
  });
  let sessionCleared = true;
  try {
    const auth = firebaseAuth();
    if (auth) await signOut(auth);
  } catch {
    // The server already erased the account. Do not report the whole deletion
    // as failed or encourage retrying it because local sign-out failed.
    sessionCleared = false;
  }
  return { ...result, sessionCleared };
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
