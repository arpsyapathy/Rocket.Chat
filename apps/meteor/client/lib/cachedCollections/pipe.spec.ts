import { pipe } from './pipe';

describe('pipe', () => {
	interface ITestData {
		_id: number;
		name: string;
		ts: number;
		date: Date;
	}

	const sampleData: ITestData[] = [
		{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
		{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
		{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
		{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
		{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
	];

	describe('missing fields', () => {
		it('should let the rows with missing fields at the end', () => {
			const arr = [...sampleData];
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 6, name: 'A', ts: 50 } as ITestData);

			const result = pipe<ITestData>().sortByField('date', 1).apply(arr);
			expect(result).toEqual([...sampleData, { _id: 6, name: 'A', ts: 50 }]);
		});
		it('should sort by fallback fields if a field is missing', () => {
			// adds randomly an row if missing date
			const arr = [...sampleData];
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 6, name: 'A', ts: 50 } as ITestData);
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 7, name: 'B', ts: 50 } as ITestData);
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 8, name: 'C', ts: 50 } as ITestData);

			const result = pipe<ITestData>().sortByField('date', 1, ['name']).apply(arr);
			expect(result).toEqual([...sampleData, { _id: 6, name: 'A', ts: 50 }, { _id: 7, name: 'B', ts: 50 }, { _id: 8, name: 'C', ts: 50 }]);
		});
		it('should sort by fallback fields if a field is missing with second signature', () => {
			// adds randomly an row if missing date
			const arr = [...sampleData];
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 6, name: 'A', ts: 50 } as ITestData);
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 7, name: 'B', ts: 50 } as ITestData);
			arr.splice(Math.floor(Math.random() * arr.length), 0, { _id: 8, name: 'C', ts: 50 } as ITestData);

			const result = pipe<ITestData>().sortByField(['date', 'name'], 1).apply(arr);
			expect(result).toEqual([...sampleData, { _id: 6, name: 'A', ts: 50 }, { _id: 7, name: 'B', ts: 50 }, { _id: 8, name: 'C', ts: 50 }]);
		});
	});

	it('should correctly slice the array with skip and limit', () => {
		const result = pipe<ITestData>().slice(1, 2).apply(sampleData);
		expect(result).toEqual([
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
		]);
	});

	it('should correctly slice the array with only limit', () => {
		const result = pipe<ITestData>().slice(0, 3).apply(sampleData);
		expect(result).toEqual([
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
		]);
	});

	it('should return an empty array if skip is greater than array length', () => {
		const result = pipe<ITestData>().slice(10, 2).apply(sampleData);
		expect(result).toEqual([]);
	});

	it('should return remaining elements if limit is greater than available', () => {
		const result = pipe<ITestData>().slice(3, 10).apply(sampleData);
		expect(result).toEqual([
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
			{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
		]);
	});

	it('should sort the array by a string field in ascending order', () => {
		const result = pipe<ITestData>().sortByField('name', 1).apply(sampleData);
		expect(result).toEqual([
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
			{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
		]);
	});

	it('should sort the array by a date field in ascending order', () => {
		const result = pipe<ITestData>()
			.sortByField('date', 1)
			.apply([...sampleData].sort(() => Math.random() - 0.5));
		expect(result).toEqual(sampleData);
	});

	it('should sort the array by a string field in descending order', () => {
		const result = pipe<ITestData>().sortByField('name', -1).apply(sampleData);
		expect(result).toEqual([
			{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
		]);
	});

	it('should sort the array by a number field in ascending order', () => {
		const result = pipe<ITestData>().sortByField('ts', 1).apply(sampleData);
		expect(result).toEqual([
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
		]);
	});

	it('should sort the array by a number field in descending order', () => {
		const result = pipe<ITestData>().sortByField('ts', -1).apply(sampleData);
		expect(result).toEqual([
			{ _id: 5, name: 'Eve', ts: 40, date: new Date('2025-07-16T05:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
		]);
	});

	it('should apply chained operations correctly (sort then slice)', () => {
		const result = pipe<ITestData>().sortByField('ts').slice(1, 3).apply(sampleData);
		expect(result).toEqual([
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
		]);
	});

	it('should apply chained operations correctly (slice then sort)', () => {
		const result = pipe<ITestData>().slice(0, 4).sortByField('name', -1).apply(sampleData);
		expect(result).toEqual([
			{ _id: 4, name: 'David', ts: 20, date: new Date('2025-07-16T04:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
		]);
	});

	it('should return an empty array when applying to an empty array', () => {
		const result = pipe<ITestData>().slice(0, 1).apply([]);
		expect(result).toEqual([]);
	});

	it('should combine two pipelines using the pipe method', () => {
		const pipeline1 = pipe<ITestData>().sortByField('name');
		const pipeline2 = pipe<ITestData>().slice(1, 2);
		const combinedPipeline = pipe<ITestData>().pipe(pipeline1).pipe(pipeline2);

		const result = combinedPipeline.apply(sampleData);
		expect(result).toEqual([
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
		]);
	});

	it('should combine pipelines and maintain initial operations', () => {
		const pipeline1 = pipe<ITestData>().sortByField('ts');
		const pipeline2 = pipe<ITestData>().slice(2, 2);
		const combinedPipeline = pipeline1.pipe(pipeline2);

		const result = combinedPipeline.apply(sampleData);
		// Expected order after ts sort: David, Charlie, Alice, Bob, Eve
		// Slice(2,2) should take: Alice, Bob
		expect(result).toEqual([
			{ _id: 1, name: 'Alice', ts: 30, date: new Date('2025-07-16T01:00:00.000Z') },
			{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
		]);
	});

	it('should handle non-existent fields in sortByField without throwing and without changing the order', () => {
		const result = pipe<ITestData>()
			.sortByField('nonExistentField' as keyof ITestData)
			.apply(sampleData);
		expect(result).toEqual(sampleData);
	});

	it('should return the original array if no operations are applied', () => {
		const result = pipe<ITestData>().apply(sampleData);
		expect(result).toEqual(sampleData);
	});

	it('should not modify the original array', () => {
		const originalData = [...sampleData];
		const result = pipe<ITestData>().sortByField('ts').apply(sampleData);
		expect(sampleData).toEqual(originalData);
		expect(result).not.toEqual(originalData);
	});

	describe('inferred type by initial data', () => {
		it('should return the original array if no operations are applied', () => {
			const result = pipe(sampleData).apply();
			expect(result).toEqual(sampleData);
		});

		it('should slice the array with skip and limit', () => {
			const result = pipe(sampleData).slice(1, 2).apply();
			expect(result).toEqual([
				{ _id: 2, name: 'Charlie', ts: 25, date: new Date('2025-07-16T02:00:00.000Z') },
				{ _id: 3, name: 'Bob', ts: 35, date: new Date('2025-07-16T03:00:00.000Z') },
			]);
		});
	});
});
