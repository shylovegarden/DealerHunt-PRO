'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The root "/" redirects to the deals dashboard
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/deals');
  }, [router]);
  return null;
}
