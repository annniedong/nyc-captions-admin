import { ActionForm, SubmitButton } from "@/components/action-form";
import { setSignupGate } from "@/lib/resource-actions";

export function SignupGate({
  enabled,
  activeDomains,
  activeEmails,
}: {
  enabled: boolean;
  activeDomains: number;
  activeEmails: number;
}) {
  const empty = activeDomains + activeEmails === 0;
  return (
    <section
      className={`mb-6 rounded-3xl border-2 p-5 sm:p-6 ${
        enabled ? "border-primary bg-primary/10" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-black">
            Signup gate is {enabled ? "ON" : "OFF"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {enabled
              ? `Only the ${activeDomains} active domain${activeDomains === 1 ? "" : "s"} and ${activeEmails} whitelisted email${activeEmails === 1 ? "" : "s"} below (plus admins) can sign in to the public app.`
              : "Anyone with a Google account can sign in to the public app. Turn it on to limit sign-in to the lists below."}
          </p>
          {enabled && empty && (
            <p className="mt-2 text-sm font-extrabold text-danger">
              Both lists are empty, so only admins can sign in right now.
            </p>
          )}
        </div>
        <ActionForm action={setSignupGate}>
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <SubmitButton
            variant={enabled ? "secondary" : "primary"}
            pendingLabel="Saving…"
          >
            {enabled ? "Turn off" : "Turn on"}
          </SubmitButton>
        </ActionForm>
      </div>
    </section>
  );
}
