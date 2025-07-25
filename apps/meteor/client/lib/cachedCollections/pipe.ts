interface IPipeReturn<D> {
	slice(skip: number, limit: number): IPipeReturn<D>;
	sortByField(fieldName: keyof D, direction?: 1 | -1, fallback?: Array<keyof D>): IPipeReturn<D>;
	sortByField(fieldName: Array<keyof D>, direction?: 1 | -1, fallback?: Array<keyof D>): IPipeReturn<D>;
	apply(): D[];
	pipe(p: IPipeReturn<D>): IPipeReturn<D>;
}

interface IPipeReturnNoInitialData<D> {
	slice(skip: number, limit: number): IPipeReturnNoInitialData<D>;
	sortByField(fieldName: keyof D, direction?: 1 | -1, fallback?: Array<keyof D>): IPipeReturnNoInitialData<D>;
	sortByField(fieldName: Array<keyof D>, direction?: 1 | -1): IPipeReturnNoInitialData<D>;
	apply(arg: D[]): D[];
	pipe(p: IPipeReturnNoInitialData<D>): IPipeReturnNoInitialData<D>;
}

type PipeFunction<D> = (arg: D[]) => D[];

const merge =
	<D>(fn: PipeFunction<D>, inner: PipeFunction<D>): PipeFunction<D> =>
	(args) =>
		fn(inner(args));

export function pipe<D>(): IPipeReturnNoInitialData<D>;
export function pipe<D>(initialData: D[]): IPipeReturn<D>;
export function pipe<D>(initialData: D[], acc: PipeFunction<D>): IPipeReturn<D>;

export function pipe<D>(
	initialData?: any,
	acc: PipeFunction<D> = (arg) => [...arg],
): typeof initialData extends undefined ? IPipeReturnNoInitialData<D> : IPipeReturn<D> {
	return {
		slice(skip = 0, limit: number) {
			return pipe<D>(
				initialData,
				merge<D>((arr: D[]) => arr.slice(skip, skip + limit), acc),
			);
		},

		sortByField(fieldName: keyof D | Array<keyof D>, direction: 1 | -1 = 1, fallback: Array<keyof D> = []) {
			if (Array.isArray(fieldName)) {
				return this.sortByField(fieldName[0], direction, fieldName.slice(1));
			}

			const sort = (fieldName: keyof D, direction: 1 | -1, fallback: Array<keyof D>) => {
				return (a: D, b: D): number => {
					const aValue = a[fieldName];
					const bValue = b[fieldName];

					if (aValue === undefined && bValue === undefined && fallback.length > 0) {
						const [field, ...rest] = fallback;
						return sort(field, direction, rest)(a, b);
					}

					if (aValue === undefined) {
						return 1;
					}

					if (bValue === undefined) {
						return -1;
					}

					if (aValue instanceof Date && bValue instanceof Date) {
						return direction * (aValue.getTime() - bValue.getTime());
					}

					if (typeof aValue === 'string' && typeof bValue === 'string') {
						return direction * aValue.localeCompare(bValue);
					}
					if (typeof aValue === 'number' && typeof bValue === 'number') {
						return direction * (aValue - bValue);
					}
					return 0;
				};
			};

			return pipe<D>(
				initialData,
				merge((arr: D[]) => [...arr].sort(sort(fieldName, direction, fallback)), acc),
			);
		},

		apply: (arg: D[]) => {
			return acc(initialData ?? arg);
		},
		pipe(p: IPipeReturn<D>) {
			return pipe<D>(initialData, merge(p.apply, acc));
		},
	};
}
