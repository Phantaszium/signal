import { PaperDetail } from "@/components/paper/PaperDetail";
import { requireReadyAccount } from "@/lib/auth/session";
import { itemsByIds } from "@/lib/db/evaluations";

export default async function PaperPage({ params }: PageProps<"/paper/[id]">) {
  const { id: raw } = await params;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Already decoded, or malformed; look it up as given.
  }
  const account = await requireReadyAccount();
  const [item] = await itemsByIds(account.id, [id]);
  return <PaperDetail id={id} fallback={item ?? null} />;
}
