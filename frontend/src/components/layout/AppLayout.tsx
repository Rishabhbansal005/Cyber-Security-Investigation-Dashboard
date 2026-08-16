import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ContactModal from '@/components/shared/ContactModal';
import CyberCopilotChat from '@/components/ai/CyberCopilotChat';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onContactOpen={() => setContactOpen(true)}
      />
      <div className={`main-content${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          onMenuToggle={() => setSidebarCollapsed((c) => !c)}
        />
        <main className="page-content animate-in">
          <Outlet />
        </main>
      </div>
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <CyberCopilotChat />
    </div>
  );
}
