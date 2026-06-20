'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Search, Calculator, Truck, Megaphone, Clock, Wallet, Wrench, LogOut, Settings } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Find', href: '/find', icon: Map },
    { name: 'Scan', href: '/scan', icon: Search },
    { name: 'Move', href: '/move', icon: Truck },
    { name: 'Fleet', href: '/fleet', icon: Clock },
    { name: 'Finance', href: '/finance', icon: Wallet },
    { name: 'Parts', href: '/parts', icon: Wrench },
  ];

  return (
    <div className="hidden md:flex h-screen w-64 flex-col bg-[#0C0C0F] border-r border-[rgba(255,255,255,.06)] text-[#9898A8]">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-[rgba(255,255,255,.06)]">
        <h1 className="text-xl font-extrabold text-[#FAFAFA] flex items-center gap-2 tracking-tight">
          <div className="w-6 h-6 rounded bg-[#F59E0B] flex items-center justify-center">
            <span className="text-[#07070A] font-bold text-sm leading-none">D</span>
          </div>
          DealerHunt
        </h1>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <div className="text-xs font-semibold leading-6 text-[#62627A] tracking-wider uppercase mb-2">DealerHunt Pro</div>
            <ul role="list" className="-mx-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href === '/find' && pathname === '/');
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`
                        group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium transition-all
                        ${isActive
                          ? 'bg-[rgba(245,158,11,.10)] text-[#F59E0B] border border-[rgba(245,158,11,.22)]'
                          : 'text-[#9898A8] hover:text-[#FAFAFA] hover:bg-[rgba(255,255,255,.05)] border border-transparent'
                        }
                      `}
                    >
                      <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-[#62627A] group-hover:text-[#D1D1DC]'}`} aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto">
            <div className="border-t border-[rgba(255,255,255,.06)] pt-4 -mx-2 space-y-1">
              <Link href="/settings" className="group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium text-[#9898A8] hover:text-[#FAFAFA] hover:bg-[rgba(255,255,255,.05)] transition-all">
                <Settings className="h-5 w-5 shrink-0 text-[#62627A] group-hover:text-[#D1D1DC]" aria-hidden="true" />
                Settings
              </Link>
              <button className="group flex w-full gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium text-[#9898A8] hover:text-[#FAFAFA] hover:bg-[rgba(255,255,255,.05)] transition-all text-left">
                <LogOut className="h-5 w-5 shrink-0 text-[#62627A] group-hover:text-[#D1D1DC]" aria-hidden="true" />
                Logout
              </button>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}
