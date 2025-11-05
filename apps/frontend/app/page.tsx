import InputForm from "@/components/Forms/InputForm";

export default function Home() {
	return (
		<>
			<InputForm />

			<div className="px-4 py-6 bg-background rounded-lg">
				<ul>
					<li>All Pokémon Here!</li>
				</ul>

				<div>Pagination Here!</div>
			</div>
		</>
	);
}
