import { supabase } from './db';

export async function setupAuthListener(callback: (user: any) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });

  return data;
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function updateUserEmail(newEmail: string) {
  return supabase.auth.updateUser({ email: newEmail });
}

export async function updateUserPassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}
