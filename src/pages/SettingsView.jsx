import React, { useState } from 'react';
import { SettingsForm } from '../components/SettingsForm';
import { Tabs } from '../components/Tabs';
import { ScrollFade } from '../components/ScrollFade';

const TABS = [
  { id: 'profile',     label: 'Profile'      },
  { id: 'medications', label: 'Medications'  },
  { id: 'display',     label: 'Display'      },
  { id: 'recording',   label: 'Recording'    },
  { id: 'reports',     label: 'Reports'      },
  { id: 'data',        label: 'Data'         },
];

export default function SettingsView({ settings, onUpdate, onReset, onBack, pwa, notificationPermission, onRequestNotificationPermission }) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="flex-1 flex flex-col w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          Settings
        </h2>
        <span className="ml-auto text-[9px] font-bold px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
          {settings.userMode === 'CARETAKER' ? 'CARETAKER' : 'SELF'}
        </span>
      </div>

      <div className="mb-4 shrink-0">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <ScrollFade>
        <SettingsForm
          settings={settings}
          onUpdate={onUpdate}
          onReset={onReset}
          pwa={pwa}
          activeTab={activeTab}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={onRequestNotificationPermission}
        />
      </ScrollFade>

    </div>
  );
}
