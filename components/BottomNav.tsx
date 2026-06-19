'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, Wrench, Map, Clock, Megaphone } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Deals', href: '/deals', icon: LayoutDashboard },
    { name: 'Scan', href: '/scanner', icon: Search },
    { name: 'Map', href: '/map', icon: Map },
    { name: 'Parts', href: '/parts', icon: Wrench },
    { name: 'Fleet', href: '/fleet', icon: Clock },
    { name: 'Syndicate', href: '/syndicate', icon: Megaphone },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0a0c]/95 backdrop-blur-md border-t border-white/10 z-50 flex justify-around items-center px-2 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === '/deals' && pathname === '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
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
