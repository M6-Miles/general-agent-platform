'use client';

import {usePathname} from 'next/navigation';
import {useEffect, useRef} from 'react';

export default function FocusManager() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      document.getElementById('main-content')?.focus();
      previousPath.current = pathname;
    }
  }, [pathname]);
  return null;
}
