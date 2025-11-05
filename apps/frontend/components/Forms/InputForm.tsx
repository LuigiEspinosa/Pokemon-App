import SvgSearch from "../Images/SvgSearch";
import SelectDropdown from "./SelectDropdown";

const InputForm = () => {
	return (
		<form className="flex gap-6 px-2 pb-8" action="/" method="get">
			<div className="flex-1 min-w-[200px] h-8 relative bg-background rounded-4xl">
				<SvgSearch
					width={20}
					height={20}
					fill="var(--color-primary)"
					className="absolute top-1.5 left-4"
				/>
				<input
					name="q"
					defaultValue={undefined}
					placeholder="Search"
					className="border-none w-full h-8 rounded-4xl py-2 pr-4 pl-12 shadow-inner-2 font-poppins text-sm text-medium appearance-none focus:border-none"
				/>
			</div>

			<SelectDropdown />
		</form>
	);
};

export default InputForm;
