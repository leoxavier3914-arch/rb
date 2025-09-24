import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export default function TestLayout({ children }: { children: ReactNode }) {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token')?.value;

  if (!adminToken || token !== adminToken) {
    redirect('/login');
  }

  return <>{children}</>;
}
