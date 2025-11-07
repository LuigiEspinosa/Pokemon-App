export default function Pagination({
	page,
	pageSize,
	total,
	q,
	sort,
}: {
	page: number;
	pageSize: number;
	total: number;
	q: string;
	sort: string;
}) {
	const totalPages = Math.ceil(total / pageSize);
	const prev = Math.max(1, page - 1);
	const next = Math.min(totalPages, page + 1);
	const qs = (p: number) => `?${new URLSearchParams({ page: String(p), q, sort })}`;

	return (
		<div className="flex items-center justify-center gap-2 mt-4">
			<a
				className={`px-3 py-2 border rounded ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
				href={qs(prev)}
			>
				Prev
			</a>
			<span className="text-sm">
				Page {page} / {totalPages}
			</span>
			<a
				className={`px-3 py-2 border rounded ${
					page === totalPages ? "pointer-events-none opacity-50" : ""
				}`}
				href={qs(next)}
			>
				Next
			</a>
		</div>
	);
}
