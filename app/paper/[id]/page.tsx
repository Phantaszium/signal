import { PaperDetail } from "@/components/paper/PaperDetail";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaperDetail id={id} />;
}
