import Link from "next/link";
import { notFound } from "next/navigation";
import EntryForm from "@/components/entry-form";
import DeleteEntryButton from "@/components/delete-entry-button";
import { getEntryAndMasters } from "@/lib/data";
import { todayJST } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { entry, masters } = await getEntryAndMasters(id);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-semibold">記録の編集</h2>
      <EntryForm masters={masters} defaultDate={todayJST()} initial={entry} />
      <div className="flex gap-2">
        <Link
          href="/list"
          className="active-scale flex flex-1 items-center justify-center rounded-full border border-outline-variant py-3 text-sm font-medium text-on-surface-variant"
        >
          戻る
        </Link>
        <DeleteEntryButton id={entry.id} />
      </div>
    </div>
  );
}
