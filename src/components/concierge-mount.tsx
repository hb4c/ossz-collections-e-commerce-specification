import { getSettings } from "@/lib/store";
import { Concierge } from "@/components/concierge";
import { waLink } from "@/lib/utils";

export async function ConciergeMount() {
  const settings = await getSettings();
  return (
    <Concierge
      greeting={settings.concierge_greeting}
      whatsappUrl={waLink(
        settings.whatsapp_number,
        "Hello OSSZ Collections, I would like some assistance please.",
      )}
      whatsappNumber={settings.whatsapp_number}
    />
  );
}
