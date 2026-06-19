'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Search, Calculator, Truck, Megaphone, Clock, Wallet, Wrench } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Find', href: '/find', icon: Map },
    { name: 'Scan', href: '/scan', icon: Search },
    { name: 'Deal', href: '/deal', icon: Calculator },
    { name: 'Move', href: '/move', icon: Truck },
    { name: 'List', href: '/list', icon: Megaphone },
    { name: 'Fleet', href: '/fleet', icon: Clock },
    { name: 'Parts', href: '/parts', icon: Wrench },
  ];

  const visibleItems = navItems.slice(0, 5);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0C0C0F]/95 backdrop-blur-md border-t border-[rgba(255,255,255,.06)] z-50 flex justify-around items-center px-2 pb-safe">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || (item.href === '/find' && pathname === '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive ? 'text-[#F59E0B]' : 'text-[#62627A] hover:text-[#D1D1DC]'
            }`}
          >
            <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
