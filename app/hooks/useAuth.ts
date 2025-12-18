import { useSession, signIn, signOut } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  const login = async (email: string, password: string) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  };

  const logout = async () => {
    await signOut({ redirect: false });
  };

  return {
    currentUser: session?.user || null,
    isLoading,
    login,
    logout,
  };
}