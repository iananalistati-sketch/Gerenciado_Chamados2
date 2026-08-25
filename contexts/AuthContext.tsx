import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "../firebase";

import {
  Permissions,
  ROLE_PERMISSIONS,
  UserRole,
} from "../auth/permissions";

interface AuthContextData {
  user: User | null;
  role: UserRole | null;
  permissions: Permissions | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext =
  createContext<AuthContextData | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null);

  const [role, setRole] =
    useState<UserRole | null>(null);

  const [permissions, setPermissions] =
    useState<Permissions | null>(null);

  const [loading, setLoading] =
    useState(true);

  async function loadUserRole(
    authenticatedUser: User
  ): Promise<void> {
    try {
      const tokenResult =
        await authenticatedUser.getIdTokenResult();

      const claimRole =
        tokenResult.claims.role;

      let resolvedRole: UserRole =
        "viewer";

      if (
        claimRole === "admin" ||
        claimRole === "analyst" ||
        claimRole === "viewer"
      ) {
        resolvedRole = claimRole;
      }

      setRole(resolvedRole);

      setPermissions(
        ROLE_PERMISSIONS[
          resolvedRole
        ]
      );
    } catch (error) {
      console.error(
        "Erro ao carregar permissões do usuário:",
        error
      );

      setRole("viewer");

      setPermissions(
        ROLE_PERMISSIONS.viewer
      );
    }
  }

  async function refreshPermissions():
    Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await auth.currentUser
        .getIdToken(true);

      await loadUserRole(
        auth.currentUser
      );
    } catch (error) {
      console.error(
        "Erro ao atualizar permissões:",
        error
      );
    }
  }

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async authenticatedUser => {
          setLoading(true);

          try {
            setUser(
              authenticatedUser
            );

            if (
              authenticatedUser
            ) {
              await loadUserRole(
                authenticatedUser
              );
            } else {
              setRole(null);
              setPermissions(null);
            }
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);

  async function login(
    email: string,
    password: string
  ): Promise<void> {
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
  }

  async function logout():
    Promise<void> {
    await signOut(auth);

    setRole(null);
    setPermissions(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        loading,
        login,
        logout,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextData {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser utilizado dentro de AuthProvider."
    );
  }

  return context;
}