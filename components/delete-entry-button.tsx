"use client";

import { useActionState } from "react";
import { deleteEntryAction, type ActionState } from "@/lib/actions";

export default function DeleteEntryButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteEntryAction,
    {}
  );
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("この記録(明細含む)を削除しますか?")) e.preventDefault();
      }}
      className="flex flex-1 flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="active-scale rounded-full border border-error/40 py-3 text-sm font-medium text-error disabled:opacity-50"
      >
        {pending ? "削除中…" : "この記録を削除する"}
      </button>
    </form>
  );
}
