"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, initEmulators, FIREBASE_AVAILABLE } from "@/lib/firebase";

const ROLE_STORAGE_KEY = "medwasteUserRole";
const DEMO_SESSION_KEY = "medwasteDemoSession";

interface AuthContextValue {
  user: FirebaseUser | null;
  loading: boolean;
  role: string | null;
  /** True when running without Firebase (local demo session). */
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Role persistence (localStorage until roles live in Firestore) -----------
export function setUserRole(role: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  // Let the mounted AuthProvider pick the change up without a page reload.
  window.dispatchEvent(new CustomEvent("medwaste:role-changed", { detail: role }));
}

export function getUserRoleSaved(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ROLE_STORAGE_KEY);
}

// --- Local demo session (used when Firebase is not configured) ---------------
function readDemoSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEMO_SESSION_KEY);
}

function writeDemoSession(email: string | null) {
  if (typeof window === "undefined") return;
  if (email) window.localStorage.setItem(DEMO_SESSION_KEY, email);
  else window.localStorage.removeItem(DEMO_SESSION_KEY);
}

/**
 * Minimal stand-in for a Firebase user in demo mode. Only the fields the UI
 * reads (uid, email, displayName) are meaningful.
 */
function demoUser(email: string): FirebaseUser {
  return {
    uid: `demo-${email}`,
    email,
    displayName: null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "demo-token",
    getIdTokenResult: async () => ({ token: "demo-token" }) as never,
    reload: async () => {},
    toJSON: () => ({ email }),
    phoneNumber: null,
    photoURL: null,
    providerId: "demo",
    metadata: { creationTime: undefined, lastSignInTime: undefined },
  } as unknown as FirebaseUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Start as null so server and client render the same markup, then hydrate.
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getUserRoleSaved() ?? "viewer");

    const onRoleChanged = () => setRole(getUserRoleSaved() ?? "viewer");
    window.addEventListener("medwaste:role-changed", onRoleChanged);
    window.addEventListener("storage", onRoleChanged);

    if (!FIREBASE_AVAILABLE || !auth) {
      // Local demo mode: no listener, no network calls.
      const email = readDemoSession();
      if (email) setUser(demoUser(email));
      setLoading(false);
      return () => {
        window.removeEventListener("medwaste:role-changed", onRoleChanged);
        window.removeEventListener("storage", onRoleChanged);
      };
    }

    initEmulators();

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (fbUser) => {
          setUser(fbUser);
          setRole(getUserRoleSaved() ?? "viewer");
          setLoading(false);
        },
        (error) => {
          console.warn("[auth] state listener error:", error);
          setLoading(false);
        }
      );
    } catch (error) {
      console.warn("[auth] Firebase unavailable, using local demo mode:", error);
      setLoading(false);
    }

    return () => {
      unsubscribe();
      window.removeEventListener("medwaste:role-changed", onRoleChanged);
      window.removeEventListener("storage", onRoleChanged);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!FIREBASE_AVAILABLE || !auth) {
      writeDemoSession(email);
      setUser(demoUser(email));
      setRole(getUserRoleSaved() ?? "viewer");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    setRole(getUserRoleSaved() ?? "viewer");
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!FIREBASE_AVAILABLE || !auth) {
      writeDemoSession(email);
      setUser(demoUser(email));
      setRole(getUserRoleSaved() ?? "viewer");
      return;
    }
    await createUserWithEmailAndPassword(auth, email, password);
    setRole(getUserRoleSaved() ?? "viewer");
  }, []);

  const signOut = useCallback(async () => {
    if (!FIREBASE_AVAILABLE || !auth) {
      writeDemoSession(null);
      setUser(null);
      return;
    }
    await fbSignOut(auth);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, role, demoMode: !FIREBASE_AVAILABLE, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  return {
    user: null,
    loading: false,
    role: null,
    demoMode: !FIREBASE_AVAILABLE,
    signIn: async () => {
      throw new Error("AuthProvider is missing. Wrap the app in <AuthProvider>.");
    },
    signUp: async () => {
      throw new Error("AuthProvider is missing. Wrap the app in <AuthProvider>.");
    },
    signOut: async () => {},
  };
}
