import { NextRequest } from 'next/server';

export interface AdminIdentity {
  authorized: boolean;
  email: string;
  userId: string | null;
}

// Auth disabled — backoffice is open
export async function getAdminIdentity(_req: NextRequest): Promise<AdminIdentity> {
  return { authorized: true, email: 'admin', userId: null };
}
