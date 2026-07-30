import { PersonPageClient } from "@/components/PersonPageClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OsobaPage({ params }: Props) {
  const { id } = await params;
  return <PersonPageClient id={decodeURIComponent(id)} />;
}
