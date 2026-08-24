import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <SettingsIcon className="h-12 w-12 text-slate-300 mb-4" />
      <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        account settings.
      </p>
    </div>
  );
}
