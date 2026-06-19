'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Search, Wrench, Map, Clock, LogOut, Settings, Megaphone, Star } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Deals Dashboard', href: '/deals', icon: LayoutDashboard },
    { name: 'Live Scanner', href: '/scanner', icon: Search },
    { name: 'Parts Teardown', href: '/parts', icon: Wrench },
    { name: 'Arbitrage Map', href: '/map', icon: Map },
    { name: 'Fleet Tracker', href: '/fleet', icon: Clock },
    { name: 'Watchlist', href: '/watchlist', icon: Star },
    { name: 'Syndicate', href: '/syndicate', icon: Megaphone },
  ];

  return (
    <div className="hidden md:flex h-screen w-64 flex-col bg-[#0a0a0c] border-r border-white/10 text-gray-300">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-white/5">
        <h1 className="text-xl font-extrabold text-white flex items-center gap-2 tracking-tight">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          </div>
          DealerHunt
        </h1>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <div className="text-xs font-semibold leading-6 text-gray-500 tracking-wider uppercase mb-2">Core Operations</div>
            <ul role="list" className="-mx-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href === '/deals' && pathname === '/');
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`
                        group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium transition-all
                        ${isActive 
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                        }
                      `}
                    >
                      <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}`} aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto">
            <div className="border-t border-white/10 pt-4 -mx-2 space-y-1">
              <a href="#" className="group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                <Settings className="h-5 w-5 shrink-0 text-gray-500 group-hover:text-gray-300" aria-hidden="true" />
                Settings
              </a>
              <a href="#" className="group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                <LogOut className="h-5 w-5 shrink-0 text-gray-500 group-hover:text-gray-300" aria-hidden="true" />
                Logout
              </a>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );
}
