import EntryForm from "@/components/entry-form";
import { getAllMasters } from "@/lib/data";
import { todayJST } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function InputPage() {
  const masters = await getAllMasters();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">
          家計簿入力
        </h2>
      </div>
      <EntryForm masters={masters} defaultDate={todayJST()} />
    </div>
  );
}
