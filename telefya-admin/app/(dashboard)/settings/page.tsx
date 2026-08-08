import { ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Platform configuration is managed securely from the backend."
      />

      <section className="max-w-3xl rounded-2xl border border-border bg-white p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
            <ShieldCheck size={21} />
          </span>

          <div>
            <h2 className="font-black text-navy-900">
              Secure configuration
            </h2>

            <p className="mt-2 text-sm leading-6 text-navy-500">
              This page is ready for future platform settings such as admin
              roles, email sender identity, retention policies, and billing
              controls. Those controls need dedicated backend endpoints before
              they are exposed here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}