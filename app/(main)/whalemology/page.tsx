'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function WhalemologyRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/whalemology/DOSS');
  }, [router]);
  return null;
}
