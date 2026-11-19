import { TopicEditor } from "@/components/topics/TopicEditor";

export const metadata = { title: "Topic" };

export default async function TopicPage({ params }: PageProps<"/topics/[id]">) {
  const { id } = await params;
  return <TopicEditor id={id} />;
}
